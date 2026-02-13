import type { ReactNode } from "react";

export interface ModalProps {
	id: string;
	title: string;
	isOpen: boolean;
	children?: ReactNode;
}

export function Modal({ id, title, isOpen, children }: ModalProps) {
	if (!isOpen) {
		return null;
	}

	return (
		<section id={id}>
			<h3>{title}</h3>
			<div>{children}</div>
		</section>
	);
}
