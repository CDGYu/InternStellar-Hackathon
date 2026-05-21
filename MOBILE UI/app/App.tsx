import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useState } from "react";
import { Toaster } from "./components/ui/sonner";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OFWDashboard from "./pages/ofw/Dashboard";
import OFWSendFunds from "./pages/ofw/SendFunds";
import OFWBills from "./pages/ofw/Bills";
import OFWWishlists from "./pages/ofw/Wishlists";
import OFWTransactions from "./pages/ofw/Transactions";
import FamilyDashboard from "./pages/family/Dashboard";
import FamilyShop from "./pages/family/Shop";
import FamilyBills from "./pages/family/Bills";
import FamilyOrders from "./pages/family/Orders";
import FamilyActivity from "./pages/family/Activity";
import StoreDashboard from "./pages/store/Dashboard";
import StoreCreateOrder from "./pages/store/CreateOrder";
import StoreOrderQueue from "./pages/store/OrderQueue";
import StoreInventory from "./pages/store/Inventory";
import StoreActivity from "./pages/store/Activity";

export type UserRole = "ofw" | "family" | "store" | null;

export interface User {
  name: string;
  role: UserRole;
  location: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />

          {/* OFW Routes */}
          <Route path="/ofw" element={user?.role === "ofw" ? <OFWDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/ofw/send" element={user?.role === "ofw" ? <OFWSendFunds user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/ofw/bills" element={user?.role === "ofw" ? <OFWBills user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/ofw/wishlists" element={user?.role === "ofw" ? <OFWWishlists user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/ofw/transactions" element={user?.role === "ofw" ? <OFWTransactions user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />

          {/* Family Routes */}
          <Route path="/family" element={user?.role === "family" ? <FamilyDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/family/shop" element={user?.role === "family" ? <FamilyShop user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/family/bills" element={user?.role === "family" ? <FamilyBills user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/family/orders" element={user?.role === "family" ? <FamilyOrders user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/family/activity" element={user?.role === "family" ? <FamilyActivity user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />

          {/* Store Routes */}
          <Route path="/store" element={user?.role === "store" ? <StoreDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/store/create-order" element={user?.role === "store" ? <StoreCreateOrder user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/store/orders" element={user?.role === "store" ? <StoreOrderQueue user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/store/inventory" element={user?.role === "store" ? <StoreInventory user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/store/activity" element={user?.role === "store" ? <StoreActivity user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}
