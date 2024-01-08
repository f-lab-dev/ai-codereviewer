export const replaceAllHashVariables=(inputString: string)=> {
    return inputString.replace(/#{(.*?)}/g, (_, variable) => {
      return `\${${variable}}`;
    });
  }