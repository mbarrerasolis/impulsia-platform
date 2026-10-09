import { describe, expect, it } from "vitest";
import { assistantInterestScores, leadTemperature, temperatureFromScore, temperatureScores } from "./lead-temperature";

describe("lead temperature", () => {
  it("clasifica por bandas de score", () => {
    expect(temperatureFromScore(90)).toBe("hot");
    expect(temperatureFromScore(75)).toBe("hot");
    expect(temperatureFromScore(74)).toBe("warm");
    expect(temperatureFromScore(50)).toBe("warm");
    expect(temperatureFromScore(49)).toBe("cold");
  });

  it("los cerrados quedan fuera del pipeline sin importar el score", () => {
    expect(leadTemperature({ score: 95, status: "converted" })).toBe("closed");
    expect(leadTemperature({ score: 95, status: "lost" })).toBe("closed");
    expect(leadTemperature({ score: 95, status: "contacted" })).toBe("hot");
  });

  it("los scores manuales y del asistente caen en la banda que representan", () => {
    for (const [temperature, score] of Object.entries(temperatureScores)) expect(temperatureFromScore(score)).toBe(temperature);
    expect(temperatureFromScore(assistantInterestScores.alto)).toBe("hot");
    expect(temperatureFromScore(assistantInterestScores.medio)).toBe("warm");
    expect(temperatureFromScore(assistantInterestScores.bajo)).toBe("cold");
  });
});
