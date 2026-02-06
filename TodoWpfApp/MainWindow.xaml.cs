using System.Drawing;
using System.Windows;
using System.Windows.Threading;
using Forms = System.Windows.Forms;
using TodoWpfApp.ViewModels;

namespace TodoWpfApp;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;
    private readonly DispatcherTimer _reminderTimer;
    private Forms.NotifyIcon? _notifyIcon;
    private bool _isExitRequested;
    private DateTime _lastReminderAt = DateTime.MinValue;

    public MainWindow()
    {
        InitializeComponent();
        _viewModel = new MainViewModel();
        DataContext = _viewModel;

        _reminderTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMinutes(5)
        };
        _reminderTimer.Tick += (_, _) => ShowDueSoonReminder();

        Loaded += (_, _) =>
        {
            InitializeTrayIcon();
            _reminderTimer.Start();
            ShowDueSoonReminder();
        };

        StateChanged += (_, _) =>
        {
            if (WindowState == WindowState.Minimized)
            {
                HideToTray();
            }
        };

        Closing += OnClosing;
    }

    private void InitializeTrayIcon()
    {
        if (_notifyIcon is not null)
        {
            return;
        }

        _notifyIcon = new Forms.NotifyIcon
        {
            Icon = SystemIcons.Information,
            Visible = true,
            Text = "TodoWpfApp",
            ContextMenuStrip = new Forms.ContextMenuStrip()
        };
        _notifyIcon.DoubleClick += (_, _) => RestoreFromTray();

        _notifyIcon.ContextMenuStrip.Items.Add("Open", null, (_, _) => RestoreFromTray());
        _notifyIcon.ContextMenuStrip.Items.Add("Exit", null, (_, _) =>
        {
            _isExitRequested = true;
            Close();
        });
    }

    private void HideToTray()
    {
        Hide();
        _notifyIcon?.ShowBalloonTip(
            1500,
            "TodoWpfApp",
            "App is still running in the system tray.",
            Forms.ToolTipIcon.Info);
    }

    private void RestoreFromTray()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void ShowDueSoonReminder()
    {
        if (_notifyIcon is null)
        {
            return;
        }

        var tasks = _viewModel.GetNotificationTargets();
        if (tasks.Count == 0)
        {
            return;
        }

        var now = DateTime.Now;
        if (now - _lastReminderAt < TimeSpan.FromMinutes(30))
        {
            return;
        }

        var overdueCount = tasks.Count(t => t.DueDate!.Value.Date < DateTime.Today);
        var dueSoonCount = tasks.Count - overdueCount;
        var message = overdueCount > 0
            ? $"Overdue: {overdueCount}, Due by tomorrow: {dueSoonCount}"
            : $"Due by tomorrow: {dueSoonCount}";

        _notifyIcon.ShowBalloonTip(
            3000,
            "Todo Reminder",
            message,
            overdueCount > 0 ? Forms.ToolTipIcon.Warning : Forms.ToolTipIcon.Info);
        _lastReminderAt = now;
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        if (!_isExitRequested)
        {
            e.Cancel = true;
            HideToTray();
            return;
        }

        _reminderTimer.Stop();
        if (_notifyIcon is not null)
        {
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            _notifyIcon = null;
        }
    }
}
