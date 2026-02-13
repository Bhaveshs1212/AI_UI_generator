export interface InputProps {
	id: string;
	label: string;
	placeholder?: string;
}

export function Input({ id, label, placeholder }: InputProps) {
	return (
		<div>
			<label htmlFor={id}>{label}</label>
			<input id={id} placeholder={placeholder} />
		</div>
	);
}
