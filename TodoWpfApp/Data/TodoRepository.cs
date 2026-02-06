using System.IO;
using Microsoft.Data.Sqlite;
using TodoWpfApp.Models;

namespace TodoWpfApp.Data;

public sealed class TodoRepository
{
    private readonly string _connectionString;

    public TodoRepository()
    {
        var appDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "TodoWpfApp");
        Directory.CreateDirectory(appDir);

        var dbPath = Path.Combine(appDir, "todos.db");
        _connectionString = $"Data Source={dbPath}";

        Initialize();
    }

    public IReadOnlyList<TodoItem> GetAll()
    {
        var items = new List<TodoItem>();

        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT Id, Title, Notes, DueDate, Priority, IsCompleted, CreatedAt
            FROM Todos
            ORDER BY IsCompleted ASC, Priority DESC, DueDate ASC, CreatedAt DESC;
            """;

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            items.Add(new TodoItem
            {
                Id = reader.GetInt32(0),
                Title = reader.GetString(1),
                Notes = reader.IsDBNull(2) ? null : reader.GetString(2),
                DueDate = reader.IsDBNull(3) ? null : DateTime.Parse(reader.GetString(3)),
                Priority = reader.GetInt32(4),
                IsCompleted = reader.GetInt32(5) == 1,
                CreatedAt = DateTime.Parse(reader.GetString(6))
            });
        }

        return items;
    }

    public int Add(TodoItem item)
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO Todos (Title, Notes, DueDate, Priority, IsCompleted, CreatedAt)
            VALUES ($title, $notes, $dueDate, $priority, $isCompleted, $createdAt);
            SELECT last_insert_rowid();
            """;
        command.Parameters.AddWithValue("$title", item.Title);
        command.Parameters.AddWithValue("$notes", (object?)item.Notes ?? DBNull.Value);
        command.Parameters.AddWithValue("$dueDate", item.DueDate?.ToString("O") ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("$priority", item.Priority);
        command.Parameters.AddWithValue("$isCompleted", item.IsCompleted ? 1 : 0);
        command.Parameters.AddWithValue("$createdAt", item.CreatedAt.ToString("O"));

        var id = (long)command.ExecuteScalar()!;
        return (int)id;
    }

    public void Update(TodoItem item)
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText =
            """
            UPDATE Todos
            SET Title = $title,
                Notes = $notes,
                DueDate = $dueDate,
                Priority = $priority,
                IsCompleted = $isCompleted
            WHERE Id = $id;
            """;
        command.Parameters.AddWithValue("$id", item.Id);
        command.Parameters.AddWithValue("$title", item.Title);
        command.Parameters.AddWithValue("$notes", (object?)item.Notes ?? DBNull.Value);
        command.Parameters.AddWithValue("$dueDate", item.DueDate?.ToString("O") ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("$priority", item.Priority);
        command.Parameters.AddWithValue("$isCompleted", item.IsCompleted ? 1 : 0);

        command.ExecuteNonQuery();
    }

    public void Delete(int id)
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM Todos WHERE Id = $id;";
        command.Parameters.AddWithValue("$id", id);
        command.ExecuteNonQuery();
    }

    private void Initialize()
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText =
            """
            CREATE TABLE IF NOT EXISTS Todos (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Title TEXT NOT NULL,
                Notes TEXT NULL,
                DueDate TEXT NULL,
                Priority INTEGER NOT NULL DEFAULT 2,
                IsCompleted INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL
            );
            """;

        command.ExecuteNonQuery();
    }
}
