import type { ReactNode } from "react";

export interface CardProps {
	id: string;
	title: string;
	children?: ReactNode;
}

export function Card({ id, title, children }: CardProps) {
	return (
		<section id={id}>
			<h3>{title}</h3>
			<div>{children}</div>
		</section>
	);
}
