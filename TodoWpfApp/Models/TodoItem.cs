using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace TodoWpfApp.Models;

public sealed class TodoItem : INotifyPropertyChanged
{
    private int _id;
    private string _title = string.Empty;
    private string? _notes;
    private DateTime? _dueDate;
    private int _priority;
    private bool _isCompleted;
    private DateTime _createdAt;

    public int Id
    {
        get => _id;
        set => SetField(ref _id, value);
    }

    public string Title
    {
        get => _title;
        set => SetField(ref _title, value);
    }

    public string? Notes
    {
        get => _notes;
        set => SetField(ref _notes, value);
    }

    public DateTime? DueDate
    {
        get => _dueDate;
        set => SetField(ref _dueDate, value);
    }

    public int Priority
    {
        get => _priority;
        set => SetField(ref _priority, value);
    }

    public bool IsCompleted
    {
        get => _isCompleted;
        set => SetField(ref _isCompleted, value);
    }

    public DateTime CreatedAt
    {
        get => _createdAt;
        set => SetField(ref _createdAt, value);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private void SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (Equals(field, value))
        {
            return;
        }

        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
