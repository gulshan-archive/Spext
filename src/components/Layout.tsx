import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Mic, History, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { to: "/", icon: Mic, label: "Record" },
  { to: "/history", icon: History, label: "History" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Sidebar — wider with labels */}
      <nav className="w-[72px] t-bg-s flex flex-col items-center py-5 gap-1 border-r t-border relative">
        {/* Logo */}
        <div className="mb-6">
          <img src="/spext-icon.svg" alt="Spext" width={36} height={36} style={{ borderRadius: 10 }} />
        </div>

        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 no-drag press ${
                isActive
                  ? "text-white"
                  : "t-text-m hover:t-text-s"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Active left bar indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                    style={{ background: "linear-gradient(180deg, #06b6d4, #3b82f6)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                {isActive && (
                  <div className="absolute inset-1 rounded-lg t-bg-h opacity-60" />
                )}
                <Icon size={18} className="relative z-10" />
                <span className="relative z-10 text-[9px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Main content with page transitions */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
