export interface ButtonProps {
	id: string;
	label: string;
	variant: "primary" | "secondary";
}

export function Button({ id, label, variant }: ButtonProps) {
	return (
		<button id={id} data-variant={variant} type="button">
			{label}
		</button>
	);
}
