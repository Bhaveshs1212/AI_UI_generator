export interface NavbarProps {
	id: string;
	title: string;
}

export function Navbar({ id, title }: NavbarProps) {
	return (
		<header id={id}>
			<div>{title}</div>
		</header>
	);
}
