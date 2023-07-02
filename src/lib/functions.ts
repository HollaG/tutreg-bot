// Function to clean the mysql stringified array
export const cleanArrayString = (arrayString: string) =>
    arrayString
        .trim()
        .split(",")
        .filter((x) => x);

/**
 * Converts a full date (e.g. Thursday) to a 3-letter abbreviation (e.g. Thu)
 *
 * @param day Full day of the week (e.g. Thursday)
 * @returns 3-letter abbreviation of the day e.g. Thu
 */
export const convertDayToAbbrev = (day: string) => {
    return day.slice(0, 3);
};
