import { after } from 'next/server'

import { Sandbox } from '@vercel/sandbox'
import { strToU8, zipSync } from 'fflate'
import { randomUUID } from 'node:crypto'

import { builderUser } from './auth'
import { database, owned } from './db'
import {
  type Files,
  previewHTML,
  projectName,
  type ProjectType,
  validateFiles
} from './files'
import { templateFiles } from './templates'

export class BuilderError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
const uuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
const requireId = (id: string) => {
  if (!uuid(id)) throw new BuilderError(404, 'This project could not be found.')
}
export async function event(
  owner: string,
  job: string,
  phase: string,
  message: string
) {
  await owned(owner, async sql => {
    await sql`insert into nova_events(job_id,owner_id,phase,message) values(${job},${owner},${phase},${message})`
    await sql`update nova_jobs set phase=${phase},updated_at=now() where id=${job}`
  })
}
async function cancelled(owner: string, id: string) {
  const rows = await owned(
    owner,
    sql => sql`select state from nova_jobs where id=${id}`
  )
  return rows[0]?.state !== 'building'
}
async function checkpoint(owner: string, id: string, files: Files) {
  await owned(
    owner,
    sql =>
      sql`update nova_jobs set checkpoint=${sql.json(files)} where id=${id} and state='building'`
  )
}

export async function runJob(owner: string, id: string) {
  await owned(owner, async sql => {
    const expired = (
      await sql`update nova_jobs set state='failed',phase='failed',error='This build could not recover after three attempts. Your last saved version is safe.',updated_at=now() where id=${id} and attempts>=3 and state='building' and lease_until<now() returning project_id`
    )[0]
    if (expired) {
      await sql`update nova_projects set status=case when current_version_id is null then 'failed' else 'ready' end where id=${expired.project_id}`
      await sql`insert into nova_events(owner_id,job_id,phase,message) values(${owner},${id},'failed','Build recovery stopped after three attempts. Your last version is safe.')`
    }
  })
  const rows = await owned(
    owner,
    sql =>
      sql`update nova_jobs set state='building',attempts=attempts+1,lease_until=now()+interval '3 minutes',updated_at=now() where id=${id} and attempts<3 and (state='queued' or (state='building' and lease_until<now())) returning *`
  )
  const job = rows[0]
  if (!job) return
  let sandbox: Sandbox | undefined
  try {
    await event(
      owner,
      id,
      'understanding',
      'Reading your request and the last saved version.'
    )
    const current = await owned(owner, async sql => {
      const p = (
        await sql`select * from nova_projects where id=${job.project_id}`
      )[0]
      const v = p?.current_version_id
        ? (
            await sql`select files from nova_versions where id=${p.current_version_id}`
          )[0]
        : null
      return { p, v }
    })
    if (!current.p || (await cancelled(owner, id))) return
    let files = job.checkpoint as Files | null
    if (!files) {
      await event(
        owner,
        id,
        'planning',
        'Planning the page structure and interactions.'
      )
      const base = process.env.OPENAI_COMPATIBLE_API_BASE_URL
      const key = process.env.OPENAI_COMPATIBLE_API_KEY
      if (!base || !key) throw new Error('provider')
      const response = await fetch(
        `${base.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b:free',
            stream: false,
            max_tokens: 6000,
            messages: [
              {
                role: 'system',
                content:
                  'You are NOVA, a careful website builder. Return ONLY a JSON object with a files object containing complete index.html, style.css, app.js, README.md. Optional manifest.json and sw.js for PWA. Use plain HTML CSS JS only, no dependencies, no external scripts, no imports, no frameworks, no tracking. All interaction must work without a server. Use semantic accessible mobile-first design and clear demonstration labels for sample products or data. Never invent real businesses, testimonials or working payments. Generated content will run in an isolated browser sandbox without network access or storage. The HTML references style.css and app.js. Include actual page content, not instructions or placeholders. Keep the entire output under 14000 characters.'
              },
              {
                role: 'user',
                content: `Project type: ${current.p.type}. Request: ${job.prompt}\n${current.v ? 'Update these complete current files, preserving working features: ' + JSON.stringify(current.v.files).slice(0, 8000) : 'Create a complete useful starter.'}`
              }
            ]
          }),
          signal: AbortSignal.timeout(55000)
        }
      )
      if (!response.ok)
        throw new Error(
          response.status === 402
            ? 'billing'
            : response.status === 429
              ? 'quota'
              : 'provider'
        )
      const result = await response.json()
      const text = result.choices?.[0]?.message?.content
      if (typeof text !== 'string') throw new Error('output')
      try {
        files = validateFiles(
          JSON.parse(
            text.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')
          ).files
        )
      } catch {
        throw new Error('output')
      }
      await checkpoint(owner, id, files)
      await event(
        owner,
        id,
        'files',
        'Project files generated, validated and saved to a checkpoint.'
      )
    } else {
      files = validateFiles(files)
      await event(
        owner,
        id,
        'files',
        'Resuming from your saved project-file checkpoint.'
      )
    }
    if (await cancelled(owner, id)) return
    await event(
      owner,
      id,
      'dependencies',
      'No third-party dependencies required for this HTML, CSS and JavaScript project.'
    )
    await event(
      owner,
      id,
      'checks',
      'Starting an isolated, network-blocked syntax check.'
    )
    sandbox = await Sandbox.create({
      timeout: 45000,
      persistent: false,
      resources: { vcpus: 1 },
      networkPolicy: 'deny-all',
      env: {}
    })
    await owned(
      owner,
      sql =>
        sql`update nova_jobs set sandbox_name=${sandbox!.name} where id=${id}`
    )
    await sandbox.writeFiles(
      Object.entries(files).map(([path, content]) => ({
        path: `/vercel/sandbox/${path}`,
        content: Buffer.from(content)
      }))
    )
    const check = await sandbox.runCommand('node', [
      '--check',
      '/vercel/sandbox/app.js'
    ])
    if (check.exitCode !== 0) throw new Error('check')
    await sandbox.stop()
    sandbox = undefined
    if (await cancelled(owner, id)) return
    await event(
      owner,
      id,
      'preview',
      'Syntax checks passed. Preparing the isolated browser preview.'
    )
    previewHTML(files)
    await owned(owner, async sql => {
      await sql`select id from nova_projects where id=${job.project_id} for update`
      const j = (
        await sql`select state from nova_jobs where id=${id} for update`
      )[0]
      if (j?.state !== 'building') return
      const v = (
        await sql`insert into nova_versions(project_id,owner_id,files,summary) values(${job.project_id},${owner},${sql.json(files!)},${job.prompt.slice(0, 180)}) returning id`
      )[0]
      await sql`update nova_projects set current_version_id=${v.id},status='ready',updated_at=now() where id=${job.project_id}`
      await sql`update nova_jobs set state='ready',phase='ready',lease_until=null,checkpoint=null,updated_at=now() where id=${id}`
      await sql`insert into nova_events(job_id,owner_id,phase,message) values(${id},${owner},'ready','Your new version is saved and ready to preview.')`
      await sql`insert into nova_messages(project_id,owner_id,role,content) values(${job.project_id},${owner},'assistant','Your project is ready. Open Preview to explore it, or describe your next change.')`
      await sql`insert into nova_usage(owner_id,job_id,kind) values(${owner},${id},'completed_build')`
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : ''
    const message =
      reason === 'billing'
        ? 'The AI provider has a billing restriction. Your saved work is safe.'
        : reason === 'quota'
          ? 'The free model is busy or rate limited. Your request is saved; please retry later.'
          : reason === 'provider'
            ? 'AI generation is unavailable right now. Your request is saved. Try again later or start from a template.'
            : reason === 'output'
              ? 'The model returned an incomplete project. Your last working version is safe. Please retry.'
              : reason === 'check'
                ? 'The generated JavaScript did not pass its syntax check. Your last working version is safe.'
                : 'The isolated build could not finish. Your files and last working version are safe. Please retry.'
    await owned(owner, async sql => {
      const j = (
        await sql`update nova_jobs set state='failed',error=${message},phase='failed',lease_until=null,updated_at=now() where id=${id} and state='building' returning project_id`
      )[0]
      if (!j) return
      await sql`update nova_projects set status=case when current_version_id is null then 'failed' else 'ready' end,updated_at=now() where id=${j.project_id}`
      await sql`insert into nova_events(job_id,owner_id,phase,message) values(${id},${owner},'failed',${message})`
    }).catch(() => console.error('NOVA job state could not be saved', id))
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {})
  }
}

export async function dispatch(
  req: Request,
  path: string[]
): Promise<Response> {
  const reference = randomUUID()
  try {
    const user = await builderUser()
    if (!user)
      throw new BuilderError(
        401,
        'Sign in to save and build your project. Your prompt will stay here.'
      )
    if (req.method !== 'GET') {
      const origin = req.headers.get('origin')
      if (
        origin &&
        ![
          'https://nova-morphic-test.vercel.app',
          'https://nova-morphic-test-an26.vercel.app',
          'http://localhost:3000'
        ].includes(origin)
      )
        throw new BuilderError(403, 'This request is not allowed.')
    }
    const body =
      req.method === 'GET' || req.method === 'DELETE'
        ? {}
        : await req.json().catch(() => {
            throw new BuilderError(400, 'Check the information you entered.')
          })
    if (
      JSON.stringify(body).length >
      (path[2] === 'assets' ? 2900000 : path[2] === 'files' ? 260000 : 20000)
    )
      throw new BuilderError(
        413,
        'This request is too large. Please shorten it.'
      )
    const [area, id, action] = path
    if (area === 'me') {
      if (req.method === 'PATCH') {
        const name = String(body.name || user.name)
          .trim()
          .slice(0, 80)
        if (!name) throw new BuilderError(422, 'Enter your name.')
        await database()`update nova_users set name=${name},updated_at=now() where id=${user.id}`
        await owned(
          user.id,
          sql =>
            sql`insert into nova_preferences(owner_id,reduced_motion,appearance) values(${user.id},${body.reduced_motion === true},${body.appearance === 'soft' ? 'soft' : 'slate'}) on conflict(owner_id) do update set reduced_motion=excluded.reduced_motion,appearance=excluded.appearance`
        )
      }
      const data = await owned(user.id, async sql => {
        const ws = (
          await sql`insert into nova_workspaces(owner_id) values(${user.id}) on conflict(owner_id) do update set owner_id=excluded.owner_id returning *`
        )[0]
        await sql`insert into nova_memberships(workspace_id,user_id,role) values(${ws.id},${user.id},'owner') on conflict do nothing`
        await sql`insert into nova_preferences(owner_id) values(${user.id}) on conflict do nothing`
        const preferences = (
          await sql`select * from nova_preferences where owner_id=${user.id}`
        )[0]
        const usage = (
          await sql`select count(*)::int as builds from nova_jobs where created_at>date_trunc('day',now())`
        )[0]
        return { workspace: ws, preferences, usage }
      })
      return Response.json({
        user: { id: user.id, name: body.name || user.name, email: user.email },
        ...data
      })
    }
    if (area === 'projects') {
      if (!id && req.method === 'GET')
        return Response.json({
          projects: await owned(
            user.id,
            sql =>
              sql`select p.*,(select slug from nova_publications where project_id=p.id) as slug from nova_projects p order by p.updated_at desc limit 100`
          )
        })
      if (!id && req.method === 'POST') {
        const type: ProjectType = ['website', 'webapp', 'pwa'].includes(
          body.type
        )
          ? body.type
          : 'website'
        const name = projectName(
          String(body.name || body.prompt || 'Untitled project')
        )
        const files = body.templateId
          ? validateFiles(templateFiles(body.templateId, type))
          : null
        const p = await owned(user.id, async sql => {
          const ws = (
            await sql`insert into nova_workspaces(owner_id) values(${user.id}) on conflict(owner_id) do update set owner_id=excluded.owner_id returning id`
          )[0]
          const existing = await sql`select id from nova_projects`
          if (existing.length >= 30)
            throw new BuilderError(
              429,
              'Your workspace has reached its 30-project limit. Archive or download work before creating more.'
            )
          const p = (
            await sql`insert into nova_projects(owner_id,workspace_id,name,type,prompt) values(${user.id},${ws.id},${name},${type},${String(body.prompt || '').slice(0, 6000)}) returning *`
          )[0]
          if (files) {
            const v = (
              await sql`insert into nova_versions(project_id,owner_id,files,summary) values(${p.id},${user.id},${sql.json(files)},'Created from a NOVA starter template') returning id`
            )[0]
            await sql`update nova_projects set current_version_id=${v.id},status='ready' where id=${p.id}`
          }
          return p
        })
        return Response.json({ project: p }, { status: 201 })
      }
      requireId(id)
      const project = await owned(
        user.id,
        async sql => (await sql`select * from nova_projects where id=${id}`)[0]
      )
      if (!project)
        throw new BuilderError(
          404,
          'This project could not be found in your workspace.'
        )
      if (!action && req.method === 'GET') {
        const detail = await owned(user.id, async sql => ({
          project,
          versions:
            await sql`select id,project_id,summary,created_at,case when id=${project.current_version_id} then files else null end as files from nova_versions where project_id=${id} order by created_at desc limit 30`,
          messages:
            await sql`select * from nova_messages where project_id=${id} order by created_at limit 100`,
          jobs: await sql`select id,state,phase,prompt,error,attempts,lease_until,created_at from nova_jobs where project_id=${id} order by created_at desc limit 10`,
          publication:
            (
              await sql`select * from nova_publications where project_id=${id}`
            )[0] || null,
          assets:
            await sql`select id,name,media_type from nova_assets where project_id=${id}`
        }))
        return Response.json(detail)
      }
      if (!action && req.method === 'PATCH') {
        if (
          body.name !== undefined &&
          (!String(body.name).trim() || String(body.name).length > 80)
        )
          throw new BuilderError(
            422,
            'Use a project name between 1 and 80 characters.'
          )
        await owned(
          user.id,
          sql =>
            sql`update nova_projects set name=${body.name ? String(body.name).trim() : project.name},archived=${typeof body.archived === 'boolean' ? body.archived : project.archived},updated_at=now() where id=${id}`
        )
        return Response.json({ ok: true })
      }
      if (!action && req.method === 'DELETE') {
        await owned(
          user.id,
          sql => sql`delete from nova_projects where id=${id}`
        )
        return Response.json({ ok: true })
      }
      if (action === 'preview' && req.method === 'GET') {
        if (!project.current_version_id)
          throw new BuilderError(
            409,
            'This project does not have a saved preview yet.'
          )
        const v = await owned(
          user.id,
          async sql =>
            (
              await sql`select files from nova_versions where id=${project.current_version_id}`
            )[0]
        )
        return new Response(previewHTML(v.files), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy':
              "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
            'Cache-Control': 'private,no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        })
      }
      if (action === 'duplicate' && req.method === 'POST') {
        const p = await owned(user.id, async sql => {
          if ((await sql`select id from nova_projects`).length >= 30)
            throw new BuilderError(
              429,
              'Your workspace has reached its 30-project limit.'
            )
          const p = (
            await sql`insert into nova_projects(owner_id,workspace_id,name,type,prompt) values(${user.id},${project.workspace_id},${(project.name + ' copy').slice(0, 80)},${project.type},${project.prompt}) returning id`
          )[0]
          if (project.current_version_id) {
            const old = (
              await sql`select * from nova_versions where id=${project.current_version_id}`
            )[0]
            const v = (
              await sql`insert into nova_versions(project_id,owner_id,files,summary) values(${p.id},${user.id},${sql.json(old.files)},'Duplicated from your own project') returning id`
            )[0]
            await sql`update nova_projects set current_version_id=${v.id},status='ready' where id=${p.id}`
          }
          return p
        })
        return Response.json({ project: p }, { status: 201 })
      }
      if (action === 'restore' && req.method === 'POST') {
        requireId(body.versionId)
        await owned(user.id, async sql => {
          await sql`select id from nova_projects where id=${id} for update`
          if (
            (
              await sql`select id from nova_jobs where project_id=${id} and state in ('queued','building')`
            ).length
          )
            throw new BuilderError(
              409,
              'Wait for this build to finish or cancel it before restoring.'
            )
          const v = (
            await sql`select id from nova_versions where id=${body.versionId} and project_id=${id}`
          )[0]
          if (!v)
            throw new BuilderError(404, 'This version could not be found.')
          await sql`update nova_projects set current_version_id=${v.id},status='ready',updated_at=now() where id=${id}`
        })
        return Response.json({ ok: true })
      }
      if (action === 'publish' && req.method === 'POST') {
        if (body.confirmPublic !== true)
          throw new BuilderError(
            422,
            'Confirm that you want this version to be public.'
          )
        if (!project.current_version_id)
          throw new BuilderError(
            409,
            'Create a working version before publishing.'
          )
        const record = await owned(user.id, async sql => {
          const r = (
            await sql`insert into nova_publications(owner_id,project_id,version_id) values(${user.id},${id},${project.current_version_id}) on conflict(project_id) do update set version_id=excluded.version_id returning *`
          )[0]
          await sql`update nova_projects set status='published',visibility='public',updated_at=now() where id=${id}`
          return r
        })
        return Response.json({
          url: `${process.env.NOVA_PUBLIC_URL}/p/${record.slug}`
        })
      }
      if (action === 'unpublish' && req.method === 'POST') {
        await owned(user.id, async sql => {
          await sql`delete from nova_publications where project_id=${id}`
          await sql`update nova_projects set visibility='private',status=case when current_version_id is null then 'draft' else 'ready' end where id=${id}`
        })
        return Response.json({ ok: true })
      }
      if (action === 'download' && req.method === 'GET') {
        if (!project.current_version_id)
          throw new BuilderError(
            409,
            'There are no project files to download yet.'
          )
        const v = await owned(
          user.id,
          async sql =>
            (
              await sql`select files from nova_versions where id=${project.current_version_id}`
            )[0]
        )
        const bytes = zipSync(
          Object.fromEntries(
            Object.entries(v.files as Files).map(([path, content]) => [
              path,
              strToU8(content)
            ])
          )
        )
        return new Response(new Uint8Array(bytes), {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="nova-${id.slice(0, 8)}.zip"`,
            'Cache-Control': 'no-store'
          }
        })
      }
      if (action === 'assets' && req.method === 'GET') {
        requireId(path[3] || '')
        const asset = await owned(
          user.id,
          async sql =>
            (
              await sql`select media_type,data from nova_assets where id=${path[3]} and project_id=${id}`
            )[0]
        )
        if (!asset)
          throw new BuilderError(
            404,
            'This reference image could not be found.'
          )
        return new Response(Buffer.from(asset.data, 'base64'), {
          headers: {
            'Content-Type': asset.media_type,
            'Cache-Control': 'private,no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        })
      }
      if (action === 'assets' && req.method === 'POST') {
        const name = String(body.name || 'Reference').slice(0, 100),
          media = String(body.mediaType || ''),
          data = String(body.data || '')
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(media))
          throw new BuilderError(415, 'Choose a PNG, JPEG or WebP image.')
        const bytes = Buffer.from(data, 'base64')
        if (bytes.length > 2097152)
          throw new BuilderError(413, 'Choose an image smaller than 2 MB.')
        const valid =
          media === 'image/png'
            ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
            : media === 'image/jpeg'
              ? bytes.subarray(0, 3).toString('hex') === 'ffd8ff'
              : bytes.subarray(0, 4).toString() === 'RIFF' &&
                bytes.subarray(8, 12).toString() === 'WEBP'
        if (!valid)
          throw new BuilderError(
            415,
            'This file does not match the selected image format.'
          )
        const asset = await owned(user.id, async sql => {
          const count = (
            await sql`select count(*)::int as n from nova_assets where project_id=${id}`
          )[0]
          if (count.n >= 4)
            throw new BuilderError(
              429,
              'A project can keep up to four reference images.'
            )
          return (
            await sql`insert into nova_assets(owner_id,project_id,name,media_type,data) values(${user.id},${id},${name},${media},${data}) returning id,name`
          )[0]
        })
        return Response.json({ asset }, { status: 201 })
      }
      if (action === 'files' && req.method === 'POST') {
        let files: Files
        try {
          files = validateFiles(body.files)
        } catch (e) {
          throw new BuilderError(
            422,
            e instanceof Error ? e.message : 'Check your project files.'
          )
        }
        await owned(user.id, async sql => {
          const p = (
            await sql`select * from nova_projects where id=${id} for update`
          )[0]
          if (p.current_version_id !== body.baseVersionId)
            throw new BuilderError(
              409,
              'This project changed in another tab. Reload before saving your edits.'
            )
          if (
            (
              await sql`select id from nova_jobs where project_id=${id} and state in ('queued','building')`
            ).length
          )
            throw new BuilderError(
              409,
              'Cancel the current build or wait for it to finish before editing files.'
            )
          const v = (
            await sql`insert into nova_versions(owner_id,project_id,files,summary) values(${user.id},${id},${sql.json(files)},'Saved a manual file edit') returning id`
          )[0]
          await sql`update nova_projects set current_version_id=${v.id},status='ready',updated_at=now() where id=${id}`
        })
        return Response.json({ ok: true })
      }
      if ((action === 'build' || action === 'check') && req.method === 'POST') {
        const checking = action === 'check'
        if (checking && !project.current_version_id)
          throw new BuilderError(
            409,
            'Save project files before checking them.'
          )
        const prompt = checking
          ? 'Check the current project files'
          : String(body.prompt || '').trim()
        if (prompt.length < 3 || prompt.length > 6000)
          throw new BuilderError(
            422,
            'Describe your project in 3 to 6,000 characters.'
          )
        requireId(body.requestKey)
        const job = await owned(user.id, async sql => {
          await sql`select id from nova_projects where id=${id} for update`
          const duplicate = (
            await sql`select * from nova_jobs where request_key=${body.requestKey}`
          )[0]
          if (duplicate) return duplicate
          const active = (
            await sql`select id from nova_jobs where project_id=${id} and state in ('queued','building')`
          )[0]
          if (active)
            throw new BuilderError(
              409,
              'This project already has a build in progress.'
            )
          const daily = (
            await sql`select count(*)::int as n from nova_jobs where created_at>date_trunc('day',now())`
          )[0]
          if (daily.n >= 5)
            throw new BuilderError(
              429,
              'Your five daily build attempts have been used. You can still edit template files or try again tomorrow (UTC).'
            )
          const cap = (
            await sql`insert into nova_limits(key,count,resets_at) values(${'builds:' + new Date().toISOString().slice(0, 10)},1,date_trunc('day',now())+interval '1 day') on conflict(key) do update set count=nova_limits.count+1 returning count`
          )[0]
          if (cap.count > 30)
            throw new BuilderError(
              429,
              'NOVA has reached today’s shared preview-build limit. Please return tomorrow (UTC).'
            )
          const j = (
            await sql`insert into nova_jobs(owner_id,project_id,request_key,prompt,checkpoint) values(${user.id},${id},${body.requestKey},${prompt},${checking ? sql.json((await sql`select files from nova_versions where id=${project.current_version_id}`)[0].files) : null}) returning *`
          )[0]
          await sql`update nova_projects set status='building',prompt=${prompt},updated_at=now() where id=${id}`
          await sql`insert into nova_messages(owner_id,project_id,role,content) values(${user.id},${id},'user',${prompt})`
          await sql`insert into nova_events(owner_id,job_id,phase,message) values(${user.id},${j.id},'queued','Build request saved. Waiting for a worker.')`
          return j
        })
        after(() => runJob(user.id, job.id))
        return Response.json({ job }, { status: 202 })
      }
    }
    if (area === 'jobs') {
      requireId(id)
      const job = await owned(
        user.id,
        async sql =>
          (
            await sql`select id,project_id,state,phase,prompt,error,lease_until,attempts from nova_jobs where id=${id}`
          )[0]
      )
      if (!job) throw new BuilderError(404, 'This build could not be found.')
      if (req.method === 'GET') {
        if (
          job.state === 'queued' ||
          (job.state === 'building' && new Date(job.lease_until) < new Date())
        )
          after(() => runJob(user.id, id))
        return Response.json({
          job,
          events: await owned(
            user.id,
            sql =>
              sql`select id,phase,message,created_at from nova_events where job_id=${id} order by id`
          )
        })
      }
      if (action === 'cancel' && req.method === 'POST') {
        await owned(user.id, async sql => {
          const j = (
            await sql`update nova_jobs set state='cancelled',phase='cancelled',updated_at=now() where id=${id} and state in ('queued','building') returning project_id`
          )[0]
          if (j) {
            await sql`update nova_projects set status=case when current_version_id is null then 'draft' else 'ready' end where id=${j.project_id}`
            await sql`insert into nova_events(owner_id,job_id,phase,message) values(${user.id},${id},'cancelled','Build cancelled. Your previous version is safe.')`
          }
        })
        return Response.json({ ok: true })
      }
    }
    throw new BuilderError(404, 'This page could not be found.')
  } catch (error) {
    const status = error instanceof BuilderError ? error.status : 503
    const message =
      error instanceof BuilderError
        ? error.message
        : 'Your workspace is temporarily unavailable. Your saved work has not been removed. Please retry.'
    console.error('NOVA request failed', {
      reference,
      status,
      kind: error instanceof Error ? error.name : 'unknown',
      code: (error as { code?: string })?.code,
      diagnostic:
        error instanceof Error
          ? error.message
              .replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')
              .slice(0, 160)
          : undefined
    })
    return Response.json(
      { error: message, reference },
      {
        status,
        headers:
          status === 429
            ? {
                'Retry-After': String(
                  Math.max(
                    1,
                    Math.ceil(
                      (Date.UTC(
                        new Date().getUTCFullYear(),
                        new Date().getUTCMonth(),
                        new Date().getUTCDate() + 1
                      ) -
                        Date.now()) /
                        1000
                    )
                  )
                )
              }
            : undefined
      }
    )
  }
}
