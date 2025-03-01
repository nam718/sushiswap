import { ChartBarIcon, InboxIcon, StopIcon } from '@heroicons/react/solid'
import { Price, Token, Type } from '@sushiswap/currency'
import { format } from 'd3'
import React, { FC, ReactNode, useCallback, useMemo } from 'react'
import colors from 'tailwindcss/colors'

import { Bound } from '../../lib/constants'
import { Chart } from './Chart'
import { useDensityChartData } from './hooks'
import { ZoomLevels } from './types'
import { FeeAmount, V3ChainId } from '@sushiswap/v3-sdk'
import { Skeleton } from '@sushiswap/ui/future/components/skeleton'

const ZOOM_LEVELS: Record<FeeAmount, ZoomLevels> = {
  [FeeAmount.LOWEST]: {
    initialMin: 0.999,
    initialMax: 1.001,
    min: 0.00001,
    max: 1.5,
  },
  [FeeAmount.LOW]: {
    initialMin: 0.999,
    initialMax: 1.001,
    min: 0.00001,
    max: 1.5,
  },
  [FeeAmount.MEDIUM]: {
    initialMin: 0.5,
    initialMax: 2,
    min: 0.00001,
    max: 20,
  },
  [FeeAmount.HIGH]: {
    initialMin: 0.5,
    initialMax: 2,
    min: 0.00001,
    max: 20,
  },
}

interface InfoBoxProps {
  message?: ReactNode
  icon: ReactNode
}

const InfoBox: FC<InfoBoxProps> = ({ message, icon }) => {
  return (
    <div className="w-full items-center flex flex-col justify-center h-full bg-white dark:bg-white/[0.02] rounded-lg">
      {icon}
      {message && (
        <span className="font-medium text-sm mt-5 text-center p-2.5 text-gray-600 dark:text-slate-400 text-slate-600">
          {message}
        </span>
      )}
    </div>
  )
}

export default function LiquidityChartRangeInput({
  chainId,
  currencyA,
  currencyB,
  feeAmount,
  ticksAtLimit,
  price,
  priceLower,
  priceUpper,
  onLeftRangeInput,
  onRightRangeInput,
  interactive,
}: {
  chainId: V3ChainId
  currencyA: Type | undefined
  currencyB: Type | undefined
  feeAmount?: FeeAmount
  ticksAtLimit: { [bound in Bound]?: boolean | undefined }
  price: number | undefined
  priceLower?: Price<Token, Token>
  priceUpper?: Price<Token, Token>
  onLeftRangeInput: (typedValue: string) => void
  onRightRangeInput: (typedValue: string) => void
  interactive: boolean
}) {
  const isSorted = currencyA && currencyB && currencyA?.wrapped.sortsBefore(currencyB?.wrapped)

  const { isLoading, error, formattedData } = useDensityChartData({
    chainId,
    token0: currencyA,
    token1: currencyB,
    feeAmount,
  })

  const onBrushDomainChangeEnded = useCallback(
    (domain: [number, number], mode: string | undefined) => {
      let leftRangeValue = Number(domain[0])
      const rightRangeValue = Number(domain[1])

      if (leftRangeValue <= 0) {
        leftRangeValue = 1 / 10 ** 6
      }

      // simulate user input for auto-formatting and other validations
      if (
        (!ticksAtLimit[isSorted ? Bound.LOWER : Bound.UPPER] || mode === 'handle' || mode === 'reset') &&
        leftRangeValue > 0
      ) {
        onLeftRangeInput(leftRangeValue.toFixed(6))
      }

      if ((!ticksAtLimit[isSorted ? Bound.UPPER : Bound.LOWER] || mode === 'reset') && rightRangeValue > 0) {
        // todo: remove this check. Upper bound for large numbers
        // sometimes fails to parse to tick.
        if (rightRangeValue < 1e35) {
          onRightRangeInput(rightRangeValue.toFixed(6))
        }
      }
    },
    [isSorted, onLeftRangeInput, onRightRangeInput, ticksAtLimit]
  )

  interactive = interactive && Boolean(formattedData?.length)

  const brushDomain: [number, number] | undefined = useMemo(() => {
    const leftPrice = isSorted ? priceLower : priceUpper?.invert()
    const rightPrice = isSorted ? priceUpper : priceLower?.invert()

    return leftPrice && rightPrice
      ? [parseFloat(leftPrice?.toSignificant(6)), parseFloat(rightPrice?.toSignificant(6))]
      : undefined
  }, [isSorted, priceLower, priceUpper])

  const brushLabelValue = useCallback(
    (d: 'w' | 'e', x: number) => {
      if (!price) return ''

      if (d === 'w' && ticksAtLimit[isSorted ? Bound.LOWER : Bound.UPPER]) return '0'
      if (d === 'e' && ticksAtLimit[isSorted ? Bound.UPPER : Bound.LOWER]) return '∞'

      const percent = (x < price ? -1 : 1) * ((Math.max(x, price) - Math.min(x, price)) / price) * 100

      return price ? `${format(Math.abs(percent) > 1 ? '.2~s' : '.2~f')(percent)}%` : ''
    },
    [isSorted, price, ticksAtLimit]
  )

  const isUninitialized = !currencyA || !currencyB || (formattedData === undefined && !isLoading)

  return (
    <div className="grid auto-rows-auto gap-3 min-h-[200px]">
      {isUninitialized ? (
        <InfoBox
          message="Your position will appear here."
          icon={<InboxIcon width={16} stroke="currentColor" className="text-slate-200" />}
        />
      ) : isLoading ? (
        <InfoBox icon={<Skeleton.Box className="w-full h-full" />} />
      ) : error ? (
        <InfoBox
          message="Liquidity data not available."
          icon={<StopIcon width={16} stroke="currentColor" className="dark:text-slate-400 text-slate-600" />}
        />
      ) : !formattedData || formattedData.length === 0 || !price ? (
        <InfoBox
          message="There is no liquidity data."
          icon={<ChartBarIcon width={16} stroke="currentColor" className="dark:text-slate-400 text-slate-600" />}
        />
      ) : (
        <div className="relative items-center justify-center">
          <Chart
            data={{ series: formattedData, current: price }}
            dimensions={{ width: 400, height: 200 }}
            margins={{ top: 10, right: 2, bottom: 20, left: 0 }}
            styles={{
              area: {
                selection: colors.blue['500'],
              },
            }}
            interactive={interactive}
            brush={{
              brushDomain,
              brushLabels: brushLabelValue,
              onBrushDomainChange: onBrushDomainChangeEnded,
              style: {
                handle: {
                  west: colors.blue['600'],
                  east: colors.blue['600'],
                },
              },
            }}
            zoomLevels={ZOOM_LEVELS[feeAmount ?? FeeAmount.MEDIUM]}
            ticksAtLimit={ticksAtLimit}
          />
        </div>
      )}
    </div>
  )
}
