import { Routes, Route } from 'react-router-dom';
import MarketingLayout from './layouts/MarketingLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './pages/Home';
import Overview from './pages/dashboard/Overview';
import Demo from './pages/dashboard/Demo';
import Conversations from './pages/dashboard/Conversations';
import Escalations from './pages/dashboard/Escalations';
import Knowledge from './pages/dashboard/Knowledge';
import ComingSoon from './pages/ComingSoon';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Connectors from './pages/dashboard/Connectors';
import Team from './pages/dashboard/Team';
import AiSettings from './pages/dashboard/AiSettings';
import Settings from './pages/dashboard/Settings';
import Embed from './pages/Embed';
import Widget from './pages/dashboard/Widget';
import { Protected } from './auth';
import WidgetLoader from './components/WidgetLoader';
import HowItWorks from './pages/HowItWorks';
import Industries from './pages/Industries';
import Security from './pages/Security';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';

export default function App() {
  return (
    <>
    <WidgetLoader />
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/industries" element={<Industries />} />
        <Route path="/security" element={<Security />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<ComingSoon title="This page is next" />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/embed" element={<Embed />} />
      <Route path="/app" element={<Protected><DashboardLayout /></Protected>}>
        <Route index element={<Overview />} />
        <Route path="demo" element={<Demo />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="escalations" element={<Escalations />} />
        <Route path="knowledge" element={<Knowledge />} />
        <Route path="connectors" element={<Connectors />} />
        <Route path="team" element={<Team />} />
        <Route path="ai-settings" element={<AiSettings />} />
        <Route path="settings" element={<Settings />} />
        <Route path="widget" element={<Widget />} />
        <Route path="*" element={<ComingSoon title="This screen is next" />} />
      </Route>
    </Routes>
    </>
  );
}
