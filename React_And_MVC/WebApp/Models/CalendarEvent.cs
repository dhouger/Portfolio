using MySql.Data.Entity;
using RestSharp;
using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;

namespace CyfPortal.Web.Models
{
    public class CalendarEvent
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
        public string Description { get; set; }
        public string Url { get; set; }
        public string DaysOfWeek { get; set; }
        public bool IsRecurring { get; set; }

        public object ToJSON()
        {
            return this.IsRecurring ? (object)ToRecurringJSON() : (object)ToSingleJSON();
        }

        public CalendarEventJSON ToSingleJSON()
        {
            var json = new CalendarEventJSON()
            {
                id = this.Id,
                title = this.Title,
                start = this.Start.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                end = this.End.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                description = this.Description,
                url = this.Url,
                isRecurring = false
            };

            return json;
        }

        public RecurringEventJSON ToRecurringJSON()
        {
            List<int> weekdays = this.DaysOfWeek.Split(',')
                                                .Select(s =>
                                                {
                                                    int i;
                                                    return Int32.TryParse(s, out i) ? i : -1;
                                                }).ToList();

            var json = new RecurringEventJSON()
            {
                id = this.Id,
                groupId = this.Title,
                title = this.Title,
                startRecur = this.Start.ToString("yyyy-MM-dd"),
                endRecur = this.End.ToString("yyyy-MM-dd"),
                startTime = this.Start.ToString("HH:mmZ"),
                endTime = this.End.ToString("HH:mmZ"),
                description = this.Description,
                url = this.Url,
                daysOfWeek = weekdays.ToArray(),
                isRecurring = true
            };

            return json;
        }
    }

    public class CalendarEventJSON
    {
        public string id { get; set; }
        public string title { get; set; }
        public string start { get; set; }
        public string end { get; set; }
        public string description { get; set; }
        public string url { get; set; }
        public Boolean isRecurring { get; set; }
    }

    public class RecurringEventJSON
    {
        public string id { get; set; }
        public string groupId { get; set; }
        public string title { get; set; }
        public string startRecur { get; set; }
        public string endRecur { get; set; }
        public string startTime { get; set; }
        public string endTime { get; set; }
        public string description { get; set; }
        public string url { get; set; }
        public int[] daysOfWeek { get; set; }
        public Boolean isRecurring { get; set; }
    }

    [DbConfigurationType(typeof(MySqlEFConfiguration))]
    public class CalendarEventContext : DbContext
    {
        public DbSet<CalendarEvent> CalendarEvents { get; set; }
        
        public CalendarEventContext() : base("name=DefaultConnection")
        {
        }

        protected override void OnModelCreating(DbModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<CalendarEvent>().ToTable("calendarevents");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.Id).HasColumnName("Id");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.Title).HasColumnName("Title");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.Start).HasColumnName("Start");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.End).HasColumnName("End");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.Description).HasColumnName("Description");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.Url).HasColumnName("Url");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.DaysOfWeek).HasColumnName("DaysOfWeek");
            modelBuilder.Entity<CalendarEvent>().Property(t => t.IsRecurring).HasColumnName("IsRecurring");
        }
    }

    public static class CalendarEventAccess
    {
        public static IRestResponse AddCalendarEvent(CalendarEvent calendarEvent)
        {
            using (var context = new CalendarEventContext())
            {
                calendarEvent.Id = Guid.NewGuid().ToString();
                calendarEvent.Start = calendarEvent.Start.ToUniversalTime();
                calendarEvent.End = calendarEvent.End.ToUniversalTime();

                context.Entry(calendarEvent).State = EntityState.Added;
                context.SaveChanges();

                RestResponse response = new RestResponse() { ResponseStatus = ResponseStatus.Completed };
                return response;
            }
        }

        public static List<CalendarEvent> GetCalendarEvents(DateTime from, DateTime to)
        {
            using (var context = new CalendarEventContext())
            {
               return context.CalendarEvents.Where(x => (x.Start <= to &&
                                                                x.End >= from) ||
                                                               (x.IsRecurring == true &&
                                                                x.Start <= from &&
                                                                x.End >= to))
                    .Select(x => x).ToList();
            }
        }

        public static IRestResponse UpdateCalendarEvent(CalendarEvent calendarEvent)
        {
            using (var context = new CalendarEventContext())
            {
                calendarEvent.Start = calendarEvent.Start.ToUniversalTime();
                calendarEvent.End = calendarEvent.End.ToUniversalTime();

                context.Entry(calendarEvent).State = EntityState.Modified;
                context.SaveChanges();

                RestResponse response = new RestResponse() { ResponseStatus = ResponseStatus.Completed };
                return response;
            }
        }

        public static IRestResponse DeleteCalendarEvent(string id)
        {
            using (var context = new CalendarEventContext())
            {
                context.CalendarEvents.Remove(context.CalendarEvents.Single(x => x.Id == id));
                context.SaveChanges();

                RestResponse response = new RestResponse() { ResponseStatus = ResponseStatus.Completed };
                return response;
            }
        }
    }
}