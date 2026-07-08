import { redirect } from "next/navigation";

// The Board of Directors lands on the Executive dashboard by default.
export default function Home() {
  redirect("/executive");
}
