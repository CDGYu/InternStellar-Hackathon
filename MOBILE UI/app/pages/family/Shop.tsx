import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ShoppingBag, Plus } from "lucide-react";
import type { User } from "../../App";
import { toast } from "sonner";

interface ShopProps {
  user: User;
  onLogout: () => void;
}

const groceryItems = [
  { name: "Canned Sardines", weight: "155g", price: "0.045 XLM", stock: 85 },
  { name: "Cooking Oil", weight: "1L", price: "0.18 XLM", stock: 47 },
  { name: "Instant Noodles", weight: "10 pcs", price: "0.12 XLM", stock: 50 },
  { name: "Powdered Milk", weight: "900g", price: "0.38 XLM", stock: 50 },
  { name: "Rice", weight: "5kg", price: "0.35 XLM", stock: 50 },
];

const medicineItems = [
  { name: "Amlodipine (maintenance)", weight: "30 tabs", price: "0.22 XLM", stock: 89 },
  { name: "Paracetamol", weight: "20 tabs", price: "0.08 XLM", stock: 90 },
  { name: "Vitamin C", weight: "30 tabs", price: "0.15 XLM", stock: 50 },
];

export default function Shop({ user, onLogout }: ShopProps) {
  const [activeTab, setActiveTab] = useState("grocery");

  const handleAddItem = (itemName: string) => {
    toast.success(`Added ${itemName} to wishlist`);
  };

  return (
    <DashboardLayout user={user} onLogout={onLogout}>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl">Build your wishlist</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick what you need from the store, then lock the funds in escrow.
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
            {groceryItems.map((item) => (
              <Card key={item.name} className="p-4 bg-card border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="mb-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.weight}</p>
                      <p className="text-sm mt-1">{item.price}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-green-500">●</span> {item.stock} left
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAddItem(item.name)}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="medicine" className="space-y-2.5 mt-5">
            <p className="text-xs text-muted-foreground uppercase mb-3">MEDICINE</p>
            {medicineItems.map((item) => (
              <Card key={item.name} className="p-4 bg-card border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="mb-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.weight}</p>
                      <p className="text-sm mt-1">{item.price}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-green-500">●</span> {item.stock} left
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAddItem(item.name)}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
