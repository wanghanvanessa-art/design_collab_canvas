import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
import Meetings from "./pages/Meetings";
import Ideas from "./pages/Ideas";
import Interviews from "./pages/Interviews";
import Knowledge from "./pages/Knowledge";
import Inspiration from "./pages/Inspiration";
import Reviews from "./pages/Reviews";
import Blindbox from "./pages/Blindbox";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/meetings" component={Meetings} />
        <Route path="/ideas" component={Ideas} />
        <Route path="/interviews" component={Interviews} />
        <Route path="/knowledge" component={Knowledge} />
        <Route path="/inspiration" component={Inspiration} />
        <Route path="/reviews" component={Reviews} />
        <Route path="/blindbox" component={Blindbox} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
