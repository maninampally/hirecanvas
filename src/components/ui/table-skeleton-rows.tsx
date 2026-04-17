type TableSkeletonRowsProps = {
  rowCount: number
  columns: string[]
}

export function TableSkeletonRows({ rowCount, columns }: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-t border-slate-100">
          {columns.map((columnWidth, columnIndex) => (
            <td key={`${rowIndex}-${columnIndex}`} className="px-4 py-4">
              <div
                className={`h-4 animate-pulse rounded bg-slate-200 ${columnWidth} ${
                  columnIndex === columns.length - 1 ? 'ml-auto' : ''
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
