import { open } from 'node:fs/promises'

export default async (fileName) => {
  // open a file
  let file = await open(fileName);

  // read the file
  let data = await file.readFile({
    encoding: 'utf8'
  });

  // return some JSON
  return JSON.parse(data);
};