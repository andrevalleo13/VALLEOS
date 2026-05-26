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
import { BootSequence } from "@/components/shell/BootSequence";
import { SoundLayer } from "@/components/shell/SoundLayer";

export default function OSLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BootSequence />
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
        <SoundLayer />
      </LockScreen>
    </>
  );
}
