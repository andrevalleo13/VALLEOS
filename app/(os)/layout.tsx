import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { AmbientBG } from "@/components/shell/AmbientBG";
import { VoiceOrb } from "@/components/shell/VoiceOrb";
import { CmdK } from "@/components/shell/CmdK";
import { CaptureModal } from "@/components/shell/CaptureModal";
import { CierreFlow } from "@/components/shell/CierreFlow";
import { AjustesDrawer } from "@/components/shell/AjustesDrawer";
import { FocusBanner } from "@/components/shell/FocusBanner";
import { LockScreen } from "@/components/shell/LockScreen";

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return (
    <LockScreen>
      <AmbientBG />
      <div className="shell">
        <Sidebar />
        <Topbar />
        <main className="shell-content">{children}</main>
      </div>
      <VoiceOrb />
      <CmdK />
      <CaptureModal />
      <CierreFlow />
      <AjustesDrawer />
      <FocusBanner />
    </LockScreen>
  );
}
