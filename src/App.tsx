import { useCallback, useState } from "react";
import { api, isPreviewMock, type Profile } from "./lib/api";
import { Login, Splash, Start, Users } from "./screens/Auth";
import { Nickname, Register } from "./screens/Register";
import { Onboarding } from "./screens/Onboarding";
import { Hub, HubWelcome } from "./screens/Hub";

type View =
  | { name: "splash" | "start" | "users" | "register" }
  | { name: "login"; email?: string }
  | { name: "nickname" | "onboarding" | "welcome"; profile: Profile }
  | { name: "hub"; profile: Profile | null; demo: boolean };

export function App() {
  const [view, setView] = useState<View>({ name: "splash" });

  const enter = useCallback((profile: Profile) => {
    setView(profile.onboardingDone ? { name: "welcome", profile } : { name: "onboarding", profile });
  }, []);

  const lock = useCallback(() => {
    void api.logout().finally(() => setView({ name: "start" }));
  }, []);

  return (
    <main className="app">
      <div className="drag" data-tauri-drag-region />
      {isPreviewMock && <div className="preview-flag">Browser-Vorschau · Daten werden nicht gespeichert</div>}
      <div className="view" key={view.name}>
        {render()}
      </div>
    </main>
  );

  function render() {
    switch (view.name) {
      case "splash":
        return (
          <Splash
            onContinue={() => setView({ name: "start" })}
            onDemo={() => setView({ name: "hub", profile: null, demo: true })}
          />
        );
      case "start":
        return (
          <Start
            onLogin={() => setView({ name: "login" })}
            onUsers={() => setView({ name: "users" })}
            onRegister={() => setView({ name: "register" })}
            onBack={() => setView({ name: "splash" })}
          />
        );
      case "login":
        return <Login email={view.email} onDone={enter} onClose={() => setView({ name: "start" })} />;
      case "users":
        return (
          <Users
            onPick={(profile) => setView({ name: "login", email: profile.email })}
            onAdd={() => setView({ name: "register" })}
            onClose={() => setView({ name: "start" })}
          />
        );
      case "register":
        return (
          <Register
            onDone={(profile) => setView({ name: "nickname", profile })}
            onLogin={() => setView({ name: "login" })}
          />
        );
      case "nickname":
        return <Nickname profile={view.profile} onDone={enter} />;
      case "onboarding":
        return (
          <Onboarding
            profile={view.profile}
            onDone={enter}
            onEditNickname={() => setView({ name: "nickname", profile: view.profile })}
          />
        );
      case "welcome": {
        const profile = view.profile;
        return (
          <HubWelcome
            onDemo={() => setView({ name: "hub", profile, demo: true })}
            onStart={() => setView({ name: "hub", profile, demo: false })}
            onLock={lock}
          />
        );
      }
      case "hub": {
        const profile = view.profile;
        return (
          <Hub
            name={profile?.displayName ?? "Max"}
            demo={view.demo}
            onBack={() => setView(profile ? { name: "welcome", profile } : { name: "splash" })}
          />
        );
      }
    }
  }
}
