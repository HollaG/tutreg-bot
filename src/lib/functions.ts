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

// Function which combines an array of numbers, making it easier to read.
// Input:
//   [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
// Output:
//   [1,10]
// Input:
//   [1,2,3, 5,6,7, 9]
// Output:
//   [1,3, 5,7, 9,9]
export const combineNumbersDatabase = (str: any) => {
  return combineNumbers(str.toString().replace(/\[|\]/g, "").split(","));
};

export const combineNumbers = (numbers: (string | number)[]) => {
  let combined = [];
  let holder: number[] = [];
  for (let i = 0; i < numbers.length; i++) {
    // if (i === 0) {
    //     combined += numbers[i];
    // } else if (i === numbers.length - 1) {
    //     combined += "-" + numbers[i];
    // } else {
    //     combined += ", " + numbers[i];
    // }
    const number = Number(numbers[i]);
    if (!holder[0]) holder[0] = number;

    if (i === numbers.length - 1) {
      holder[1] = number;
    } else if (holder[0]) {
      if (Number(numbers[i + 1]) - number === 1) {
        // the next number is 1 away from the current number, ignore
      } else {
        // the next number if more than 1 away
        holder[1] = number;
      }
    }

    if (holder[0] && holder[1]) {
      if (holder[0] === holder[1]) combined.push(holder[0]);
      else combined.push(`${holder[0]}-${holder[1]}`);

      holder = [];
    }
  }

  return combined.join(", ");
};
