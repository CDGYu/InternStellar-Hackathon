import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Slider } from "../../components/ui/slider";
import { Send, ArrowRight } from "lucide-react";
import type { User } from "../../App";
import { toast } from "sonner";

interface SendFundsProps {
  user: User;
  onLogout: () => void;
}

export default function SendFunds({ user, onLogout }: SendFundsProps) {
  const [amount, setAmount] = useState("50");
  const [utilities, setUtilities] = useState(30);
  const [groceries, setGroceries] = useState(60);
  const [emergency, setEmergency] = useState(10);

  const total = utilities + groceries + emergency;
  const isValid = total === 100;

  const handleSliderChange = (category: "utilities" | "groceries" | "emergency", value: number[]) => {
    const newValue = value[0];

    if (category === "utilities") {
      setUtilities(newValue);
      const remaining = 100 - newValue;
      const ratio = groceries / (groceries + emergency);
      setGroceries(Math.round(remaining * ratio));
      setEmergency(100 - newValue - Math.round(remaining * ratio));
    } else if (category === "groceries") {
      setGroceries(newValue);
      const remaining = 100 - newValue;
      const ratio = utilities / (utilities + emergency);
      setUtilities(Math.round(remaining * ratio));
      setEmergency(100 - newValue - Math.round(remaining * ratio));
    } else {
      setEmergency(newValue);
      const remaining = 100 - newValue;
      const ratio = utilities / (utilities + groceries);
      setUtilities(Math.round(remaining * ratio));
      setGroceries(100 - newValue - Math.round(remaining * ratio));
    }
  };

  const handleSend = () => {
    if (!isValid) {
      toast.error("Allocation must total 100%");
      return;
    }
    toast.success(`Successfully sent ${amount} XLM to Lola Cora`);
  };

  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#5b7cff] to-[#7c9aff] rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Send className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-4xl font-bold text-foreground">Send funds</h1>
          </div>
          <p className="text-muted-foreground text-base leading-relaxed">
            Deposit into three on-chain buckets. Your family spends from each one independently — money knows where it's for.
          </p>
        </div>

        {/* Amount Input */}
        <Card className="p-6 bg-card border-0 shadow-lg shadow-black/5 rounded-3xl">
          <div className="flex justify-between items-start mb-6">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2 block">AMOUNT (XLM)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-4xl h-auto border-0 bg-transparent p-0 w-32 font-bold"
              />
              <p className="text-xs text-muted-foreground mt-2">≈ {parseInt(amount) * 10000000} stroops</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">ALLOCATION TOTAL</p>
              <p className={`text-4xl font-bold ${isValid ? 'text-primary' : 'text-destructive'}`}>{total}%</p>
              <p className="text-xs mt-2">
                {isValid ? (
                  <span className="text-green-600 font-medium">✓ Ready to send</span>
                ) : (
                  <span className="text-destructive font-medium">Must equal 100%</span>
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Allocation Sliders */}
        <Card className="p-6 bg-card border-0 shadow-lg shadow-black/5 rounded-3xl">
          <h3 className="text-xl font-bold text-foreground mb-6">Allocate funds</h3>

          <div className="space-y-8">
            {/* Utilities */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-base font-semibold text-foreground">Utilities</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Electricity, water, internet</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{utilities}%</p>
              </div>
              <Slider
                value={[utilities]}
                onValueChange={(value) => handleSliderChange("utilities", value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Groceries */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-base font-semibold text-foreground">Groceries</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rice, vegetables, milk, daily food</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{groceries}%</p>
              </div>
              <Slider
                value={[groceries]}
                onValueChange={(value) => handleSliderChange("groceries", value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* Emergency */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-base font-semibold text-foreground">Emergency</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Medicine & contingency</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{emergency}%</p>
              </div>
              <Slider
                value={[emergency]}
                onValueChange={(value) => handleSliderChange("emergency", value)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={!isValid}
            className="w-full mt-8 bg-gradient-to-r from-[#5b7cff] to-[#7c9aff] hover:from-[#4a6bef] hover:to-[#6b89ef] text-white rounded-2xl py-7 shadow-lg shadow-primary/25 font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send {amount} XLM
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
