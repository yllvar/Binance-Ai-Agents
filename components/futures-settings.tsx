"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface FuturesSettingsProps {
  config: any
  onChange: (key: string, value: any) => void
}

export function FuturesSettings({ config, onChange }: FuturesSettingsProps) {
  const [hedgeMode, setHedgeMode] = useState(config.futuresSpecific?.hedgeMode || false)
  const [defaultLeverage, setDefaultLeverage] = useState(config.futuresSpecific?.defaultLeverage || 3)
  const [marginType, setMarginType] = useState<"ISOLATED" | "CROSSED">(config.futuresSpecific?.marginType || "ISOLATED")
  const [maxOpenPositions, setMaxOpenPositions] = useState((config.riskParameters as any)?.maxOpenPositions || 5)

  const handleHedgeModeChange = (checked: boolean) => {
    setHedgeMode(checked)
    onChange("futuresSpecific.hedgeMode", checked)
  }

  const handleDefaultLeverageChange = (value: number[]) => {
    setDefaultLeverage(value[0])
    onChange("futuresSpecific.defaultLeverage", value[0])
  }

  const handleMarginTypeChange = (checked: boolean) => {
    const newMarginType = checked ? "ISOLATED" : "CROSSED"
    setMarginType(newMarginType)
    onChange("futuresSpecific.marginType", newMarginType)
  }

  const handleMaxOpenPositionsChange = (value: number[]) => {
    setMaxOpenPositions(value[0])
    onChange("riskParameters.maxOpenPositions", value[0])
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Futures Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Futures trading involves significant risk. Use caution when setting leverage and margin type.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="hedge-mode">Hedge Mode</Label>
            <p className="text-xs text-gray-500">Allow both long and short positions on the same symbol</p>
          </div>
          <Switch id="hedge-mode" checked={hedgeMode} onCheckedChange={handleHedgeModeChange} />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="default-leverage">Default Leverage: {defaultLeverage}x</Label>
          </div>
          <Slider
            id="default-leverage"
            min={1}
            max={20}
            step={1}
            value={[defaultLeverage]}
            onValueChange={handleDefaultLeverageChange}
          />
          <p className="text-xs text-gray-500">
            Higher leverage increases both potential profits and risks of liquidation
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="margin-type">Isolated Margin</Label>
            <p className="text-xs text-gray-500">
              Isolated margin limits risk to the amount allocated to each position
            </p>
          </div>
          <Switch id="margin-type" checked={marginType === "ISOLATED"} onCheckedChange={handleMarginTypeChange} />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="max-positions">Maximum Open Positions: {maxOpenPositions}</Label>
          </div>
          <Slider
            id="max-positions"
            min={1}
            max={10}
            step={1}
            value={[maxOpenPositions]}
            onValueChange={handleMaxOpenPositionsChange}
          />
          <p className="text-xs text-gray-500">Limit the number of positions to manage risk</p>
        </div>
      </CardContent>
    </Card>
  )
}
