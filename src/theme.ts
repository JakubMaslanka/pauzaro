import { createTheme } from "@mantine/core";

export const theme = createTheme({
	fontFamily: "Nunito, sans-serif",
	headings: {
		fontFamily: "Nunito, sans-serif",
		fontWeight: "800",
	},
	primaryColor: "teal",
	defaultRadius: "md",
	colors: {
		sand: [
			"#FFF9F0",
			"#F7F5F0",
			"#F0EBE0",
			"#E8DFD0",
			"#E0D3C0",
			"#D4C4A8",
			"#C4B090",
			"#B09878",
			"#967C5C",
			"#7A6248",
		],
	},
	other: {
		bgWarm: "#F7F5F0",
		accentSandy: "#E28743",
	},
});
