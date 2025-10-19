module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src"],
	testMatch: ["**/../tests/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[tj]s?(x)"],
	collectCoverageFrom: [
		"src/**/*.{ts,js}",
		"!src/**/*.d.ts",
		"!src/index.ts", // Exclude the index file as it's just exports
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "clover"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
	},
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: "tsconfig.json",
			},
		],
	},
};
