export interface ChartProps {
	id: string;
	title: string;
	data: number[];
}

export function Chart({ id, title, data }: ChartProps) {
	return (
		<section id={id}>
			<h3>{title}</h3>
			<ul>
				{data.map((value, index) => (
					<li key={`${id}-point-${index}`}>{value}</li>
				))}
			</ul>
		</section>
	);
}
