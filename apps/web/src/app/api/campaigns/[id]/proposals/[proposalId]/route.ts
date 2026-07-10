import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { deleteProposal, setProposalAvailability } from '@/lib/data/proposals';

type Params = { params: Promise<{ id: string; proposalId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, proposalId } = await params;
    const body = await request.json();
    await setProposalAvailability(id, proposalId, Boolean(body?.available));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, proposalId } = await params;
    await deleteProposal(id, proposalId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
