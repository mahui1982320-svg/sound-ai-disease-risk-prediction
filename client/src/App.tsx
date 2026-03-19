import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AlarmsList from "./pages/AlarmsList";
import ElderlyManagement from "./pages/ElderlyManagement";
import Statistics from "./pages/Statistics";
import DeviceManagement from "./pages/DeviceManagement";
import EventMonitor from "./pages/EventMonitor";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/alarms">
        <DashboardLayout>
          <AlarmsList />
        </DashboardLayout>
      </Route>
      <Route path="/elderly">
        <DashboardLayout>
          <ElderlyManagement />
        </DashboardLayout>
      </Route>
      <Route path="/statistics">
        <DashboardLayout>
          <Statistics />
        </DashboardLayout>
      </Route>
      <Route path="/devices">
        <DashboardLayout>
          <DeviceManagement />
        </DashboardLayout>
      </Route>
      <Route path="/events">
        <DashboardLayout>
          <EventMonitor />
        </DashboardLayout>
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
