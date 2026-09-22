export const COUNTRIES: [string, string][] = [
  ["AE","United Arab Emirates"],["AR","Argentina"],["AT","Austria"],["AU","Australia"],["BD","Bangladesh"],["BE","Belgium"],
  ["BH","Bahrain"],["BR","Brazil"],["CA","Canada"],["CH","Switzerland"],["CL","Chile"],["CN","China"],["CO","Colombia"],
  ["CY","Cyprus"],["CZ","Czechia"],["DE","Germany"],["DK","Denmark"],["EE","Estonia"],["EG","Egypt"],["ES","Spain"],
  ["FI","Finland"],["FR","France"],["GB","United Kingdom"],["GR","Greece"],["HK","Hong Kong"],["HR","Croatia"],["HU","Hungary"],
  ["ID","Indonesia"],["IE","Ireland"],["IL","Israel"],["IN","India"],["IT","Italy"],["JP","Japan"],["KE","Kenya"],
  ["KR","South Korea"],["KW","Kuwait"],["LK","Sri Lanka"],["LT","Lithuania"],["LU","Luxembourg"],["LV","Latvia"],
  ["MA","Morocco"],["MT","Malta"],["MX","Mexico"],["MY","Malaysia"],["NG","Nigeria"],["NL","Netherlands"],["NO","Norway"],
  ["NP","Nepal"],["NZ","New Zealand"],["OM","Oman"],["PE","Peru"],["PH","Philippines"],["PK","Pakistan"],["PL","Poland"],
  ["PT","Portugal"],["QA","Qatar"],["RO","Romania"],["SA","Saudi Arabia"],["SE","Sweden"],["SG","Singapore"],["SI","Slovenia"],
  ["SK","Slovakia"],["TH","Thailand"],["TR","Turkey"],["TW","Taiwan"],["UA","Ukraine"],["US","United States"],
  ["VN","Vietnam"],["ZA","South Africa"],
];
export const countryName = (c: string) => COUNTRIES.find(([k]) => k === c)?.[1] ?? c;
