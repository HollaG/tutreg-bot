// Function to clean the mysql stringified array
export const cleanArrayString = (arrayString: string) => arrayString.trim().split(",").filter(x => x)