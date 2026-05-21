import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Receipt, Plus } from "lucide-react";
import type { User } from "../../App";
import { toast } from "sonner";

interface BillsProps {
  user: User;
  onLogout: () => void;
}

export default function Bills({ user, onLogout }: BillsProps) {
  const [biller, setBiller] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleAddBill = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Bill added successfully. The OFW will see it on Jiffe.");
    setBiller("");
    setAccountNumber("");
    setAmount("");
    setDueDate("");
  };

  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Bills</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Add a household bill so your OFW can settle it from their dashboard — Meralco, Maynilad, and any other seeded biller.
          </p>
        </div>

        {/* Add Bill Form */}
        <Card className="p-5 bg-card border-border">
          <div className="flex items-center gap-2 mb-5">
            <h3 className="text-base">ADD A BILL</h3>
          </div>

          <form onSubmit={handleAddBill} className="space-y-4">
            <div>
              <Label htmlFor="biller" className="text-sm text-muted-foreground mb-2 block">
                BILLER
              </Label>
              <Select value={biller} onValueChange={setBiller} required>
                <SelectTrigger className="bg-secondary border-0 rounded-xl h-12">
                  <SelectValue placeholder="Maynilad - water" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meralco">Meralco - Electricity</SelectItem>
                  <SelectItem value="maynilad">Maynilad - Water</SelectItem>
                  <SelectItem value="pldt">PLDT - Internet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="account" className="text-sm text-muted-foreground mb-2 block">
                ACCOUNT NUMBER
              </Label>
              <Input
                id="account"
                type="text"
                placeholder="e.g. 1234-5678"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="bg-secondary border-0 rounded-xl h-12"
                required
              />
            </div>

            <div>
              <Label htmlFor="amount" className="text-sm text-muted-foreground mb-2 block">
                AMOUNT (XLM)
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g. 30"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-secondary border-0 rounded-xl h-12"
                required
              />
              <p className="text-xs text-muted-foreground mt-2">
                1 XLM ≈ 10000000 stroops
              </p>
            </div>

            <div>
              <Label htmlFor="dueDate" className="text-sm text-muted-foreground mb-2 block">
                DUE DATE
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-secondary border-0 rounded-xl h-12"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-5 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add bill
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-3 p-3 bg-secondary/50 rounded-xl">
            Added a Maynilad bill. The OFW will see it on Jiffe.
          </p>
        </Card>

        {/* Current Bills Info */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm mb-1">Nothing outstanding right now.</p>
              <p className="text-xs text-muted-foreground">
                • 3 PAID · VIEW RECEIPTS
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
