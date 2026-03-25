import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import TopNav from "./components/TopNav";
import PixelCat from "./components/PixelCat";
import Home from "./pages/Home";
import Meetings from "./pages/Meetings";
import Ideas from "./pages/Ideas";
import Interviews from "./pages/Interviews";
import Knowledge from "./pages/Knowledge";
import Inspiration from "./pages/Inspiration";
import Reviews from "./pages/Reviews";
import Blindbox from "./pages/Blindbox";

// PageLayout wraps all non-home pages with TopNav + PixelCat
function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F8F6]">
      <TopNav />
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {children}
      </main>
      <PixelCat activityLevel={0} />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Home has its own TopNav + layout */}
      <Route path="/" component={Home} />

      {/* Feature pages use PageLayout */}
      <Route path="/meetings">
        <PageLayout><Meetings /></PageLayout>
      </Route>
      <Route path="/ideas">
        <PageLayout><Ideas /></PageLayout>
      </Route>
      <Route path="/interviews">
        <PageLayout><Interviews /></PageLayout>
      </Route>
      <Route path="/knowledge">
        <PageLayout><Knowledge /></PageLayout>
      </Route>
      <Route path="/inspiration">
        <PageLayout><Inspiration /></PageLayout>
      </Route>
      <Route path="/reviews">
        <PageLayout><Reviews /></PageLayout>
      </Route>
      <Route path="/blindbox">
        <PageLayout><Blindbox /></PageLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
