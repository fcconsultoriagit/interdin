import type { Metadata } from "next";
import { MeetingRsvpPage } from "@/components/meeting-rsvp-page";

export const metadata: Metadata = {
  title: "Confirmação de Reunião | InterDin",
  robots: { index: false, follow: false },
};

export default async function ConfirmarReuniaoPage({
  searchParams,
}: PageProps<"/reunioes/confirmar">) {
  const { token = "" } = await searchParams;
  return <MeetingRsvpPage token={Array.isArray(token) ? token[0] ?? "" : token} />;
}
