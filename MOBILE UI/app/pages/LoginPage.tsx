import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { User } from "../App";

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const demoAccounts = [
  { name: "Auntie Maria", role: "ofw" as const, location: "Philippines" },
  { name: "Lola Cora", role: "family" as const, location: "Philippines" },
  { name: "Alog Nena", role: "store" as const, location: "Philippines" },
];

export default function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For demo purposes, just login as Auntie Maria
    onLogin(demoAccounts[0]);
    navigate("/ofw");
  };

  const handleDemoLogin = (account: typeof demoAccounts[0]) => {
    onLogin(account);
    const path = account.role === "ofw" ? "/ofw" : account.role === "family" ? "/family" : "/store";
    navigate(path);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-5">
      <div className="max-w-md w-full">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4 text-muted-foreground hover:text-foreground hover:bg-secondary/50 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="bg-card rounded-3xl p-8 shadow-xl shadow-black/5">
          {/* Brand */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-1">InternStellar</h2>
            <p className="text-xs text-muted-foreground">Chain Bridge</p>
          </div>

          {/* Headline */}
          <h1 className="text-3xl mb-2 font-bold text-foreground">Welcome back.</h1>
          <p className="text-muted-foreground mb-8 text-sm">Sign in to your InternStellar account.</p>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <Label htmlFor="email" className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">
                EMAIL
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/30 border-0 rounded-2xl h-12 text-sm px-4"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">
                PASSWORD
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/30 border-0 rounded-2xl h-12 text-sm px-4"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-6 shadow-lg shadow-primary/25 font-semibold text-sm mt-6"
            >
              Sign in
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Demo Accounts */}
          <div className="border-t border-border pt-6">
            <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-wider font-medium">OR TRY A DEMO ACCOUNT</p>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.name}
                  onClick={() => handleDemoLogin(account)}
                  className="p-3 bg-secondary/30 hover:bg-secondary/50 rounded-2xl transition-all text-center"
                >
                  <p className="text-[10px] text-muted-foreground uppercase mb-1.5 font-medium">
                    {account.role}
                  </p>
                  <p className="text-xs font-semibold text-foreground">{account.name}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-4">
              Password for all demo accounts: demo123456
            </p>
          </div>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              New here?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-primary hover:underline font-semibold"
              >
                Create an account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
