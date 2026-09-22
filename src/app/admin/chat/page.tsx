import { Suspense } from "react";
import ChatInbox from "./ChatInbox";

export default function ChatPage() {
  return (
    <Suspense>
      <ChatInbox />
    </Suspense>
  );
}
