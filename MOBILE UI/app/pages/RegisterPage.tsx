import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { User, UserRole } from "../App";

interface RegisterPageProps {
  onLogin: (user: User) => void;
}

export default function RegisterPage({ onLogin }: RegisterPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;

    const user: User = {
      name,
      role,
      location: "Philippines",
    };

    onLogin(user);
    const path = role === "ofw" ? "/ofw" : role === "family" ? "/family" : "/store";
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
          <h1 className="text-3xl mb-2 font-bold text-foreground">Create account.</h1>
          <p className="text-muted-foreground mb-8 text-sm">Join InternStellar and start sending smart remittances.</p>

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">
                FULL NAME
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Dela Cruz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-secondary/30 border-0 rounded-2xl h-12 text-sm px-4"
                required
              />
            </div>

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
                required
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
                required
              />
            </div>

            <div>
              <Label htmlFor="role" className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">
                ACCOUNT TYPE
              </Label>
              <Select onValueChange={(value) => setRole(value as UserRole)} required>
                <SelectTrigger className="bg-secondary/30 border-0 rounded-2xl h-12 text-sm px-4">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ofw">OFW (Overseas Filipino Worker)</SelectItem>
                  <SelectItem value="family">Family (Recipient)</SelectItem>
                  <SelectItem value="store">Store (Sari-Sari)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-full py-6 shadow-lg shadow-primary/25 font-semibold text-sm mt-6"
              disabled={!role}
            >
              Create account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary hover:underline font-semibold"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
