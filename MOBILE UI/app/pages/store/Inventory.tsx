import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ShoppingBag, Edit } from "lucide-react";
import type { User } from "../../App";

interface InventoryProps {
  user: User;
  onLogout: () => void;
}

const groceryInventory = [
  { name: "Canned Sardines", weight: "155g", price: "0.045 XLM", stock: 85, stockStatus: "left" },
  { name: "Cooking Oil", weight: "1L", price: "0.18 XLM", stock: 47, stockStatus: "left" },
  { name: "Instant Noodles", weight: "10 pcs", price: "0.12 XLM", stock: 50, stockStatus: "left" },
  { name: "Powdered Milk", weight: "900g", price: "0.38 XLM", stock: 50, stockStatus: "left" },
  { name: "Rice", weight: "5kg", price: "0.35 XLM", stock: 50, stockStatus: "left" },
];

const medicineInventory = [
  { name: "Amlodipine (maintenance)", weight: "30 tabs", price: "0.22 XLM", stock: 89, stockStatus: "left" },
  { name: "Paracetamol", weight: "20 tabs", price: "0.08 XLM", stock: 90, stockStatus: "left" },
  { name: "Vitamin C", weight: "30 tabs", price: "0.15 XLM", stock: 50, stockStatus: "left" },
];

export default function Inventory({ user, onLogout }: InventoryProps) {
  const [activeTab, setActiveTab] = useState("grocery");

  const renderInventoryList = (items: typeof groceryInventory) => (
    <div className="space-y-2.5">
      {items.map((item) => (
        <Card key={item.name} className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="mb-1 text-sm">{item.name}</p>
              <p className="text-xs text-muted-foreground mb-1">{item.weight}</p>
              <p className="text-sm mb-1">{item.price}</p>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500">●</span> {item.stock} {item.stockStatus}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg text-xs"
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Inventory</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            What's on the shelves right now.
          </p>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="grocery" className="flex-1">Grocery</TabsTrigger>
            <TabsTrigger value="medicine" className="flex-1">Medicine</TabsTrigger>
          </TabsList>

          <TabsContent value="grocery" className="space-y-2.5 mt-5">
            <p className="text-xs text-muted-foreground uppercase mb-3">GROCERY</p>
            {renderInventoryList(groceryInventory)}
          </TabsContent>

          <TabsContent value="medicine" className="space-y-2.5 mt-5">
            <p className="text-xs text-muted-foreground uppercase mb-3">MEDICINE</p>
            {renderInventoryList(medicineInventory)}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
