using CyfPortal.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using ServiceStack;

namespace CyfPortal.API.Requests
{
    [Route("/Downloads", Verbs = "GET")]
    public class GetDownloadsRequest
    {

    }

    [Route("/CSV", Verbs = "GET")]
    public class GetCSVRequest
    {

    }

    [Route("/CSV/Historical", Verbs = "GET")]
    public class GetCSVHistoricalRequest
    {
        [ApiMember(IsRequired = true)]
        public string Symbol { get; set; }

        [ApiMember(IsRequired = true)]
        public string FromDate { get; set; }

        [ApiMember(IsRequired = true)]
        public string ToDate { get; set; }

        [ApiMember(IsRequired = true)]
        public int Filter { get; set; }

        [ApiMember(IsRequired = true)]
        public int Filter2 { get; set; }

        [ApiMember(IsRequired = false)]
        public int FilterSector { get; set; }
    }

    [Route("/CSV/Flow", Verbs = "GET")]
    public class GetCSVFlowRequest
    {
        [ApiMember(IsRequired = true)]
        public DateTime RequestedDate { get; set; }

        [ApiMember(IsRequired = true)]
        public string Symbol { get; set; }

        [ApiMember(IsRequired = true)]
        public int Filter { get; set; }

        [ApiMember(IsRequired = true)]
        public int Filter2 { get; set; }

        [ApiMember(IsRequired = true)]
        public int FilterSector { get; set; }
    }

    [Route("/CSV/AlertStream", Verbs = "GET")]
    public class GetCSVAlertRequest
    {
        [ApiMember(IsRequired = false)]
        public string Symbol { get; set; }

        [ApiMember(IsRequired = true)]
        public string Market { get; set; }

        [ApiMember(IsRequired = false)]
        public int AlertStreamFilter { get; set; }

        [ApiMember(IsRequired = false)]
        public string AlertStreamStartDate { get; set; }

        [ApiMember(IsRequired = false)]
        public string AlertStreamEndDate { get; set; }
    }

    [Route("/IMG", Verbs = "GET")]
    public class GetIMGRequest
    {

    }

    [Route("/IMG/HTMLToJPG", Verbs = "POST")]
    public class PostHTMLToJPGRequest
    {
        [ApiMember(IsRequired = true)]
        public string HTML { get; set; }

        [ApiMember(IsRequired = false)]
        public int Height { get; set; }

        [ApiMember(IsRequired = false)]
        public int Width { get; set; }
    }

}