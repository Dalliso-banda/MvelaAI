import { Routes, Route } from 'react-router-dom';
import MarketingLayout from './layouts/MarketingLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './pages/Home';
import Overview from './pages/dashboard/Overview';
import ComingSoon from './pages/ComingSoon';
import HowItWorks from './pages/HowItWorks';
import Industries from './pages/Industries';
import Security from './pages/Security';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';

export default function App() {
  return (
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
      <Route path="/app" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route path="*" element={<ComingSoon title="This screen is next" />} />
      </Route>
    </Routes>
  );
}
