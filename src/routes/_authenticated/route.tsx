import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Library, MessageSquare, LayoutDashboard, LogOut, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth", replace: true });
      else router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, navigate]);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex flex-col w-64 border-r bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-6 border-b">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-foreground text-background grid place-items-center">
              <FileText className="size-4" />
            </div>
            <div>
              <div className="font-display text-lg leading-none">Atrium</div>
              <div className="text-xs text-muted-foreground mt-1">Document Intelligence</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/library" icon={<Library className="size-4" />}>Library</NavLink>
          <NavLink to="/chat" icon={<MessageSquare className="size-4" />}>Chat</NavLink>
          <NavLink to="/analytics" icon={<LayoutDashboard className="size-4" />}>Analytics</NavLink>
        </nav>
        <div className="p-3 border-t">
          <div className="px-2 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent transition-colors"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
