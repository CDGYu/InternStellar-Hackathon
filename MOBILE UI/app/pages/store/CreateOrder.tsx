import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ClipboardList, Plus, Minus } from "lucide-react";
import type { User } from "../../App";
import { toast } from "sonner";

interface CreateOrderProps {
  user: User;
  onLogout: () => void;
}

const groceryItems = [
  { name: "Canned Sardines", weight: "155g", price: 0.045, stock: 85 },
  { name: "Cooking Oil", weight: "1L", price: 0.18, stock: 47 },
  { name: "Instant Noodles", weight: "10 pcs", price: 0.12, stock: 50 },
  { name: "Powdered Milk", weight: "900g", price: 0.38, stock: 50 },
  { name: "Rice", weight: "5kg", price: 0.35, stock: 50 },
];

const medicineItems = [
  { name: "Amlodipine (maintenance)", weight: "30 tabs", price: 0.22, stock: 89 },
  { name: "Paracetamol", weight: "20 tabs", price: 0.08, stock: 90 },
  { name: "Vitamin C", weight: "30 tabs", price: 0.15, stock: 50 },
];

export default function CreateOrder({ user, onLogout }: CreateOrderProps) {
  const [activeTab, setActiveTab] = useState("grocery");
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  const handleQuantityChange = (itemName: string, change: number) => {
    setSelectedItems(prev => {
      const current = prev[itemName] || 0;
      const newValue = Math.max(0, current + change);
      if (newValue === 0) {
        const { [itemName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemName]: newValue };
    });
  };

  const getTotalAmount = () => {
    const allItems = [...groceryItems, ...medicineItems];
    return Object.entries(selectedItems).reduce((total, [name, quantity]) => {
      const item = allItems.find(i => i.name === name);
      return total + (item?.price || 0) * quantity;
    }, 0);
  };

  const handleSubmit = () => {
    const totalItems = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
    if (totalItems === 0) {
      toast.error("Please add at least one item");
      return;
    }
    toast.success("Order created successfully and sent for approval");
    setSelectedItems({});
    setNotes("");
  };

  const renderItemList = (items: typeof groceryItems) => (
    <div className="space-y-2.5">
      {items.map((item) => {
        const quantity = selectedItems[item.name] || 0;
        return (
          <Card key={item.name} className="p-3.5 bg-card border-border">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="mb-1">{item.name}</p>
                <p className="text-xs text-muted-foreground mb-1">{item.weight}</p>
                <p className="text-sm">{item.price} XLM</p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-500">●</span> {item.stock} left
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuantityChange(item.name, -1)}
                  disabled={quantity === 0}
                  className="w-8 h-8 p-0 rounded-lg"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-8 text-center">{quantity}</span>
                <Button
                  size="sm"
                  onClick={() => handleQuantityChange(item.name, 1)}
                  className="w-8 h-8 p-0 rounded-lg bg-primary hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Create order</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Build a walk-in order on a family's behalf. It lands in the queue as <strong>pending approval</strong> and follows the same lock / deliver / release flow.
          </p>
        </div>

        {/* Order Summary */}
        <Card className="p-5 bg-card border-border">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-xs text-muted-foreground">FOR FAMILY</p>
              <p className="text-base">Lola Cora - Philippines</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">ORDER TOTAL</p>
              <p className="text-xl text-primary">{getTotalAmount().toFixed(2)} XLM</p>
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm text-muted-foreground mb-2 block">
              NOTES (OPTIONAL)
            </Label>
            <Input
              id="notes"
              type="text"
              placeholder="e.g. Walk-in"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-secondary border-0 rounded-xl h-12"
            />
          </div>
        </Card>

        {/* Items Selection */}
        <div>
          <p className="text-xs text-muted-foreground uppercase mb-3">
            ITEMS ({Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0)} SELECTED)
          </p>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-secondary">
              <TabsTrigger value="grocery" className="flex-1">Grocery</TabsTrigger>
              <TabsTrigger value="medicine" className="flex-1">Medicine</TabsTrigger>
            </TabsList>

            <TabsContent value="grocery" className="mt-3">
              {renderItemList(groceryItems)}
            </TabsContent>

            <TabsContent value="medicine" className="mt-3">
              {renderItemList(medicineItems)}
            </TabsContent>
          </Tabs>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl py-5 shadow-lg shadow-primary/20"
        >
          Create order for Lola Cora
        </Button>
      </div>
    </DashboardLayout>
  );
}
