using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;
using System.Windows.Input;
using TodoWpfApp.Commands;
using TodoWpfApp.Data;
using TodoWpfApp.Models;

namespace TodoWpfApp.ViewModels;

public sealed class MainViewModel : ViewModelBase
{
    public enum TaskFilter
    {
        All,
        Today,
        ThisWeek,
        Completed
    }

    private readonly TodoRepository _repository = new();

    private TodoItem? _selectedItem;
    private string _titleInput = string.Empty;
    private string _notesInput = string.Empty;
    private DateTime? _dueDateInput = DateTime.Today;
    private int _priorityInput = 2;
    private TaskFilter _currentFilter = TaskFilter.All;

    public MainViewModel()
    {
        Items = new ObservableCollection<TodoItem>(_repository.GetAll());
        FilteredItems = CollectionViewSource.GetDefaultView(Items);
        FilteredItems.Filter = FilterItem;

        AddCommand = new RelayCommand(_ => Add(), _ => !string.IsNullOrWhiteSpace(TitleInput));
        UpdateCommand = new RelayCommand(_ => Update(), _ => SelectedItem is not null && !string.IsNullOrWhiteSpace(TitleInput));
        DeleteCommand = new RelayCommand(_ => Delete(), _ => SelectedItem is not null);
        ToggleCompleteCommand = new RelayCommand(_ => ToggleComplete(), _ => SelectedItem is not null);
        ClearInputCommand = new RelayCommand(_ => ClearInput());
        ReloadCommand = new RelayCommand(_ => Reload());
        SetFilterCommand = new RelayCommand(SetFilter);
    }

    public ObservableCollection<TodoItem> Items { get; }
    public ICollectionView FilteredItems { get; }

    public TodoItem? SelectedItem
    {
        get => _selectedItem;
        set
        {
            if (!SetProperty(ref _selectedItem, value))
            {
                return;
            }

            if (value is null)
            {
                return;
            }

            TitleInput = value.Title;
            NotesInput = value.Notes ?? string.Empty;
            DueDateInput = value.DueDate;
            PriorityInput = value.Priority;

            RaiseCanExecute();
        }
    }

    public string TitleInput
    {
        get => _titleInput;
        set
        {
            if (SetProperty(ref _titleInput, value))
            {
                RaiseCanExecute();
            }
        }
    }

    public string NotesInput
    {
        get => _notesInput;
        set => SetProperty(ref _notesInput, value);
    }

    public DateTime? DueDateInput
    {
        get => _dueDateInput;
        set => SetProperty(ref _dueDateInput, value);
    }

    public int PriorityInput
    {
        get => _priorityInput;
        set => SetProperty(ref _priorityInput, Math.Clamp(value, 1, 3));
    }

    public TaskFilter CurrentFilter
    {
        get => _currentFilter;
        set
        {
            if (!SetProperty(ref _currentFilter, value))
            {
                return;
            }

            OnPropertyChanged(nameof(IsAllFilter));
            OnPropertyChanged(nameof(IsTodayFilter));
            OnPropertyChanged(nameof(IsThisWeekFilter));
            OnPropertyChanged(nameof(IsCompletedFilter));
            FilteredItems.Refresh();
        }
    }

    public bool IsAllFilter => CurrentFilter == TaskFilter.All;
    public bool IsTodayFilter => CurrentFilter == TaskFilter.Today;
    public bool IsThisWeekFilter => CurrentFilter == TaskFilter.ThisWeek;
    public bool IsCompletedFilter => CurrentFilter == TaskFilter.Completed;

    public ICommand AddCommand { get; }
    public ICommand UpdateCommand { get; }
    public ICommand DeleteCommand { get; }
    public ICommand ToggleCompleteCommand { get; }
    public ICommand ClearInputCommand { get; }
    public ICommand ReloadCommand { get; }
    public ICommand SetFilterCommand { get; }

    private void Add()
    {
        var todo = new TodoItem
        {
            Title = TitleInput.Trim(),
            Notes = string.IsNullOrWhiteSpace(NotesInput) ? null : NotesInput.Trim(),
            DueDate = DueDateInput,
            Priority = PriorityInput,
            IsCompleted = false,
            CreatedAt = DateTime.UtcNow
        };

        todo.Id = _repository.Add(todo);
        Items.Insert(0, todo);
        FilteredItems.Refresh();
        ClearInput();
    }

    private void Update()
    {
        if (SelectedItem is null)
        {
            return;
        }

        SelectedItem.Title = TitleInput.Trim();
        SelectedItem.Notes = string.IsNullOrWhiteSpace(NotesInput) ? null : NotesInput.Trim();
        SelectedItem.DueDate = DueDateInput;
        SelectedItem.Priority = PriorityInput;

        _repository.Update(SelectedItem);
        Reload();
    }

    private void Delete()
    {
        if (SelectedItem is null)
        {
            return;
        }

        _repository.Delete(SelectedItem.Id);
        Items.Remove(SelectedItem);
        FilteredItems.Refresh();
        SelectedItem = null;
        ClearInput();
    }

    private void ToggleComplete()
    {
        if (SelectedItem is null)
        {
            return;
        }

        SelectedItem.IsCompleted = !SelectedItem.IsCompleted;
        _repository.Update(SelectedItem);
        Reload();
    }

    private void Reload()
    {
        Items.Clear();
        foreach (var item in _repository.GetAll())
        {
            Items.Add(item);
        }
        FilteredItems.Refresh();
    }

    private void ClearInput()
    {
        TitleInput = string.Empty;
        NotesInput = string.Empty;
        DueDateInput = DateTime.Today;
        PriorityInput = 2;
        SelectedItem = null;
    }

    private void RaiseCanExecute()
    {
        ((RelayCommand)AddCommand).RaiseCanExecuteChanged();
        ((RelayCommand)UpdateCommand).RaiseCanExecuteChanged();
        ((RelayCommand)DeleteCommand).RaiseCanExecuteChanged();
        ((RelayCommand)ToggleCompleteCommand).RaiseCanExecuteChanged();
    }

    private void SetFilter(object? parameter)
    {
        if (parameter is not string raw || !Enum.TryParse<TaskFilter>(raw, true, out var nextFilter))
        {
            return;
        }

        CurrentFilter = nextFilter;
    }

    private bool FilterItem(object obj)
    {
        if (obj is not TodoItem item)
        {
            return false;
        }

        var today = DateTime.Today;
        var dueDate = item.DueDate?.Date;

        return CurrentFilter switch
        {
            TaskFilter.Today => !item.IsCompleted && dueDate == today,
            TaskFilter.ThisWeek => !item.IsCompleted && dueDate is not null && IsWithinThisWeek(dueDate.Value, today),
            TaskFilter.Completed => item.IsCompleted,
            _ => true
        };
    }

    private static bool IsWithinThisWeek(DateTime dueDate, DateTime today)
    {
        var start = today.AddDays(-(int)today.DayOfWeek + (int)DayOfWeek.Monday);
        if (today.DayOfWeek == DayOfWeek.Sunday)
        {
            start = today.AddDays(-6);
        }

        var end = start.AddDays(6);
        return dueDate >= start && dueDate <= end;
    }

    public IReadOnlyList<TodoItem> GetNotificationTargets()
    {
        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);

        return Items
            .Where(item => !item.IsCompleted && item.DueDate is not null)
            .Where(item => item.DueDate!.Value.Date <= tomorrow)
            .OrderBy(item => item.DueDate)
            .ToList();
    }
}
