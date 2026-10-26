import Builder from '@/components/builder/dashboard'
export default async function Page({
  params
}: {
  params: Promise<{ id: string }>
}) {
  return <Builder projectId={(await params).id} />
}
