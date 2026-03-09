import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Header from "../components/layout/Header";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("Header", () => {
  const defaultProps = {
    sidebarOpen: false,
    setSidebarOpen: vi.fn(),
    autoRefresh: true,
    setAutoRefresh: vi.fn(),
    lastRefreshed: "12:00:00",
    onOpenAdmin: vi.fn(),
    notifications: [],
    onClearNotifications: vi.fn(),
    onDismissNotification: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders the app title", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText("\ud14c.\uc77d.\ub0a8. Agent")).toBeDefined();
  });

  it("shows realtime badge when autoRefresh is on", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText("\uc2e4\uc2dc\uac04")).toBeDefined();
  });

  it("shows paused badge when autoRefresh is off", () => {
    render(<Header {...defaultProps} autoRefresh={false} />);
    expect(screen.getByText("\uc77c\uc2dc\uc815\uc9c0")).toBeDefined();
  });

  it("toggles dark mode on button click", () => {
    render(<Header {...defaultProps} />);
    const darkButton = screen.getByLabelText("\ub2e4\ud06c\ubaa8\ub4dc \uc804\ud658");
    fireEvent.click(darkButton);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "dark");
  });
});
