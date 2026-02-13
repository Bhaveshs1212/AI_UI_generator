export interface SidebarProps {
	id: string;
	items: string[];
}

export function Sidebar({ id, items }: SidebarProps) {
	return (
		<nav id={id}>
			<ul>
				{items.map((item, index) => (
					<li key={`${id}-item-${index}`}>{item}</li>
				))}
			</ul>
		</nav>
	);
}
