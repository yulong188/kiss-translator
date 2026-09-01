const mockQuery = jest.fn();
const mockSendMessage = jest.fn();
const mockExecuteScript = jest.fn();

jest.mock("./browser", () => ({
  browser: {
    tabs: { query: mockQuery, sendMessage: mockSendMessage },
    scripting: { executeScript: mockExecuteScript },
  },
}));

const { sendTabMsg } = require("./msg");

const missingReceiverError = () =>
  new Error("Could not establish connection. Receiving end does not exist.");

describe("sendTabMsg", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue([{ id: 42 }]);
  });

  test("sends directly when the page content script is ready", async () => {
    mockSendMessage.mockResolvedValue({ rule: { transOpen: "false" } });

    await expect(
      sendTabMsg("toggle_translate", { enabled: true })
    ).resolves.toEqual({ rule: { transOpen: "false" } });

    expect(mockSendMessage).toHaveBeenCalledWith(42, {
      action: "toggle_translate",
      args: { enabled: true },
    });
    expect(mockExecuteScript).not.toHaveBeenCalled();
  });

  test("waits for a late content-script listener before injecting", async () => {
    mockSendMessage
      .mockRejectedValueOnce(missingReceiverError())
      .mockResolvedValueOnce({ ready: true });

    await expect(sendTabMsg("get_rule")).resolves.toEqual({ ready: true });
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockExecuteScript).not.toHaveBeenCalled();
  });

  test("injects content.js into an already-open page and retries", async () => {
    for (let index = 0; index < 5; index += 1) {
      mockSendMessage.mockRejectedValueOnce(missingReceiverError());
    }
    mockSendMessage.mockResolvedValueOnce({ ready: true });
    mockExecuteScript.mockResolvedValue();

    await expect(sendTabMsg("get_rule")).resolves.toEqual({ ready: true });

    expect(mockExecuteScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ["content.js"],
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(6);
  });

  test("does not hide unrelated messaging failures", async () => {
    mockSendMessage.mockRejectedValue(
      new Error("Unexpected messaging failure")
    );

    await expect(sendTabMsg("get_rule")).rejects.toThrow(
      "Unexpected messaging failure"
    );
    expect(mockExecuteScript).not.toHaveBeenCalled();
  });
});
