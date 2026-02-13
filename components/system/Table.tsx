export interface TableProps {
	id: string;
	columns: string[];
	rows: string[][];
}

export function Table({ id, columns, rows }: TableProps) {
	return (
		<table id={id}>
			<thead>
				<tr>
					{columns.map((column, index) => (
						<th key={`${id}-col-${index}`}>{column}</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row, rowIndex) => (
					<tr key={`${id}-row-${rowIndex}`}>
						{row.map((cell, cellIndex) => (
							<td key={`${id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}
