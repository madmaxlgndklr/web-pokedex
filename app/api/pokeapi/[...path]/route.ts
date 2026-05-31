import { NextRequest, NextResponse } from 'next/server'

const UPSTREAM = process.env.POKEAPI_BASE ?? 'https://madmaxlgndklrpokeapi.com/api/v2'

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const segments = (params.path ?? []).filter(Boolean)
  const search = req.nextUrl.search
  const url = `${UPSTREAM}/${segments.join('/')}/${search}`

  const res = await fetch(url, { next: { revalidate: 86400 } })
  if (!res.ok) return new NextResponse(null, { status: res.status })

  const data = await res.json()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
  })
}
